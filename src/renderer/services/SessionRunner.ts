// ============================================================================
// Integration Layer: Wires all rebuilt systems together
// ============================================================================

import { QueryEngine, type QueryEvent, type ToolCallRecord } from './QueryEngine'
import { CostTracker } from './CostTracker'
import { StreamingToolExecutor } from './StreamingToolExecutor'
import { checkToolPermission, type PermissionContext } from './PermissionSystem'
import { withRetry } from './ApiRetry'
import { estimateTokens, runContextPipeline, shouldAutoCompact } from './ContextCompaction'
import { getDynamicSkills, startSkillDiscoveryPrefetch, collectSkillDiscoveryPrefetch } from './Skills'
import { waitForPermission } from '../store/permissionStore'
import type { Message } from '../types'
import type { Tool } from './Tool'
import { DEFAULT_TOOLS } from './Tool'
import { getPluginManager } from './PluginSystem'
import { getAllMcpTools } from './McpToolAdapter'
import { toModelMessages, fromSimpleMessage, type RichMessage } from './MessageParts'

// ============================================================================
// Model Caller: Wraps API client into async generator for QueryEngine
// ============================================================================

export type ModelCaller = (
  messages: Message[],
  systemPrompt: string,
  signal: AbortSignal,
) => AsyncGenerator<{ content: string; isThinking: boolean; usage?: Partial<import('./CostTracker').TokenUsage> }>

export function createModelCaller(
  client: {
    chat: (messages: any[], stream?: boolean, thinking?: boolean, budgetTokens?: number) => Promise<AsyncIterableIterator<string>>
  },
  thinkingEnabled: boolean,
  budgetTokens: number,
  model: string = 'default',
  fallbackModel?: string,
): ModelCaller {
  return async function* (messages, systemPrompt, signal) {
    const richMessages: RichMessage[] = messages.map(m => fromSimpleMessage({
      role: m.role,
      content: m.content,
      id: m.id,
      timestamp: m.timestamp,
    }))

    const modelMessages = toModelMessages(richMessages, { filterCompacted: true })

    // Prepend the active system prompt at the start
    if (systemPrompt) {
      modelMessages.unshift({ role: 'system', content: systemPrompt })
    }

    // Inject per-turn system reminder on first turn only (API-safe at conversation start)
    const hasAssistantMessages = modelMessages.some(m => m?.role === 'assistant')
    if (!hasAssistantMessages) {
      const reminderMsg = {
        role: 'system' as const,
        content: [
          '## Available Capabilities',
          '- Read, Glob, Grep, Write, Edit, Bash: core file operations',
          '- Skill tool: invoke domain-specific workflows from SKILL.md files — use when a relevant skill exists for the task',
          '- task tool: delegate complex tasks to sub-agents for focused exploration and multi-step work',
          'When explaining your approach, explicitly identify which tools, skills, or agents you will use and why.',
        ].join('\n'),
      }
      let insertIdx = 0
      for (let i = 0; i < modelMessages.length; i++) {
        if (modelMessages[i]?.role === 'system') insertIdx = i + 1
        else break
      }
      modelMessages.splice(insertIdx, 0, reminderMsg)
    }

    // Inject stored memories as system context
    try {
      const { useMemoryStore } = await import('../store/memoryStore')
      const memories = useMemoryStore.getState().listMemories()
      if (memories.length > 0) {
        const memoryBlock = memories.map(m => `  - ${m.key}: ${m.value}`).join('\n')
        modelMessages.splice(0, 0, { role: 'system', content: `## Stored Memories\n${memoryBlock}\n\nUse these memories for context when relevant.` })
      }
    } catch { /* memory store not available */ }

    // Merge consecutive role:'user' messages — tool results are stored as role:'user'
    // (QueryEngine.ts line 298-304), causing consecutive user messages that violate
    // the alternating user/assistant requirement enforced by some APIs (e.g. NVIDIA NIM).
    const merged: Array<Record<string, any>> = []
    for (const msg of modelMessages) {
      if (msg.role !== 'user') { merged.push(msg); continue }
      const prev = merged[merged.length - 1]
      if (prev && prev.role === 'user') {
        const prevText = typeof prev.content === 'string' ? prev.content : (Array.isArray(prev.content) ? prev.content.map((p: any) => p.text ?? '').join('\n') : '')
        const currText = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.map((p: any) => p.text ?? '').join('\n') : '')
        merged[merged.length - 1] = { ...prev, content: prevText + '\n\n---\n\n' + currText }
      } else {
        merged.push(msg)
      }
    }
    modelMessages.splice(0, modelMessages.length, ...merged)

    // Insert a directive to encourage tools, skills, agents, and summary in responses
    let injectIdx = -1
    for (let i = modelMessages.length - 1; i >= 0; i--) {
      if (modelMessages[i]?.role === 'user') { injectIdx = i; break }
    }
    if (injectIdx >= 0) {
      modelMessages.splice(injectIdx, 0, {
        role: 'user' as const,
        content: '[system: Remember to use Read/Glob/Grep tools, mention skills and agents where relevant, cite file paths with line numbers, and end with a ## Summary.]',
      })
    }

    const retryGen = withRetry<AsyncIterableIterator<string>>(
      async function* (_attempt) {
        try {
          const stream = await client.chat(modelMessages, true, thinkingEnabled, budgetTokens)
          yield { type: 'complete' as const, result: stream }
        } catch (error) {
          throw error
        }
      },
      { model, fallbackModel, signal },
    )

    let stream: AsyncIterableIterator<string> | undefined

    for await (const event of retryGen) {
      if (event.type === 'retry_event' && event.event) {
        continue
      }

      if (event.type === 'complete' && event.result) {
        stream = event.result
        break
      }
    }

    if (!stream) throw new Error('Failed to get stream from API')

    for await (const chunk of stream) {
      if (signal.aborted) break

      const isThinking = (chunk as any).isThinking ?? false
      const tokens = estimateTokens(chunk)

      yield {
        content: typeof chunk === 'string' ? chunk : String(chunk),
        isThinking,
        usage: { outputTokens: tokens },
      }
    }
  }
}

// ============================================================================
// Tool Executor: Wires permission checks into StreamingToolExecutor
// ============================================================================

export function createToolExecutorWithPermissions(
  tools: Tool[],
  permissionContext: PermissionContext,
): StreamingToolExecutor {
  const executor = new StreamingToolExecutor(tools)

  // Wrap the executor's executeToolCalls to inject permission checks
  const originalExecute = executor.executeToolCalls.bind(executor)

  executor.executeToolCalls = async (toolCalls, context) => {
    const pm = getPluginManager()

    // Pre-check permissions for each tool call
    for (const call of toolCalls) {
      const tool = executor.getTool(call.name)
      if (!tool) {
        call.status = 'failed'
        call.error = `Tool not found: ${call.name}`
        continue
      }

      // Plugin hooks: before_read_file / before_write_file / before_command
      if (call.name === 'Read' || call.name === 'Grep' || call.name === 'Glob') {
        await pm.emit('before_read_file', { filePath: call.input.filePath ?? call.input.file_path, toolName: call.name, input: call.input })
      } else if (call.name === 'Write' || call.name === 'Edit') {
        await pm.emit('before_write_file', { filePath: call.input.filePath ?? call.input.file_path, toolName: call.name, input: call.input })
      } else if (call.name === 'Bash') {
        await pm.emit('before_command', { command: call.input.command, toolName: call.name, input: call.input })
      }

      const permission = await checkToolPermission({
        toolName: call.name,
        input: call.input,
        context: permissionContext,
        isReadOnly: tool.isReadOnly(call.input),
        isDestructive: tool.isDestructive?.(call.input),
      })

      if (permission.behavior === 'deny') {
        call.status = 'failed'
        call.error = permission.message ?? 'Permission denied'
        continue
      }

      if (permission.behavior === 'ask' && !permissionContext.shouldAvoidPermissionPrompts) {
        const riskLevel = tool.isDestructive?.(call.input)
          ? 'dangerous'
          : tool.isReadOnly(call.input)
            ? 'safe'
            : 'moderate' as const

        const allowed = await waitForPermission({
          id: call.id,
          toolName: call.name,
          input: call.input,
          riskLevel,
          description: permission.message ?? `Allow "${call.name}"?`,
          timestamp: Date.now(),
        })

        if (!allowed) {
          call.status = 'failed'
          call.error = 'Permission denied by user'
        }
      }
    }

    const results = await originalExecute(toolCalls, context)

    // Plugin hooks: after_read_file / after_write_file / after_command
    for (const call of toolCalls) {
      if (call.status === 'completed') {
        if (call.name === 'Read' || call.name === 'Grep' || call.name === 'Glob') {
          await pm.emit('after_read_file', { filePath: call.input.filePath ?? call.input.file_path, toolName: call.name, result: call.result })
        } else if (call.name === 'Write' || call.name === 'Edit') {
          await pm.emit('after_write_file', { filePath: call.input.filePath ?? call.input.file_path, toolName: call.name, result: call.result })
        } else if (call.name === 'Bash') {
          await pm.emit('after_command', { command: call.input.command, toolName: call.name, result: call.result })
        }
      }
    }

    return results
  }

  return executor
}

// ============================================================================
// Full Session Runner: Wires QueryEngine + CostTracker + ToolExecutor
// ============================================================================

export class SessionRunner {
  queryEngine: QueryEngine
  costTracker: CostTracker
  toolExecutor: StreamingToolExecutor
  permissionContext: PermissionContext
  tools: Tool[]

  constructor(
    model: string = 'default',
    permissionContext?: Partial<PermissionContext>,
  ) {
    this.queryEngine = new QueryEngine()
    this.costTracker = new CostTracker(model)
    this.tools = [...DEFAULT_TOOLS, ...getAllMcpTools()]

    this.permissionContext = {
      mode: 'default',
      alwaysAllowRules: {},
      alwaysDenyRules: {},
      alwaysAskRules: {},
      shouldAvoidPermissionPrompts: false,
      ...(permissionContext ?? {}),
    }

    this.toolExecutor = createToolExecutorWithPermissions(
      this.tools,
      this.permissionContext,
    )
  }

  setModel(model: string): void {
    this.costTracker.setModel(model)
  }

  setPermissionMode(mode: import('./PermissionSystem').PermissionMode): void {
    this.permissionContext.mode = mode
  }

  setAvoidPermissionPrompts(avoid: boolean): void {
    this.permissionContext.shouldAvoidPermissionPrompts = avoid
  }

  addPermissionRule(
    type: 'allow' | 'deny' | 'ask',
    source: string,
    ruleString: string,
  ): void {
    const map = type === 'allow'
      ? this.permissionContext.alwaysAllowRules
      : type === 'deny'
        ? this.permissionContext.alwaysDenyRules
        : this.permissionContext.alwaysAskRules

    if (!map[source]) map[source] = []
    map[source].push(ruleString)
  }

  registerTool(tool: Tool): void {
    this.tools.push(tool)
    this.toolExecutor.registerTool(tool)
  }

  // Run a full turn with skill discovery prefetch and plugin hooks
  async *runTurn(
    input: string,
    messages: Message[],
    systemPrompt: string,
    modelCaller: ModelCaller,
  ): AsyncGenerator<QueryEvent> {
    const turnNumber = this.costTracker.getTurns().length + 1
    this.costTracker.startTurn(turnNumber)

    // Plugin hooks: before_query
    const pm = getPluginManager()
    await pm.emit('before_query', { input, messages, turnNumber })

    // Check compaction
    let msgs = [...messages]
    if (shouldAutoCompact(msgs, this.costTracker.getModel())) {
      const result = await runContextPipeline(msgs, this.costTracker.getModel())
      if (result.tokensFreed > 0) {
        msgs = result.messages
        yield {
          type: 'compaction_triggered',
          originalCount: messages.length,
          compactedCount: msgs.length,
          compactedMessages: result.messages,
        }
      }
    }

    // Skill discovery prefetch (runs concurrent with model streaming)
    const skills = getDynamicSkills()
    const skillPrefetch = startSkillDiscoveryPrefetch(input, skills)

    // Run via QueryEngine
    const gen = this.queryEngine.submitMessage(
      input,
      msgs,
      systemPrompt,
      modelCaller,
      async (toolCall: ToolCallRecord, signal: AbortSignal) => {
        try {
          const result = await this.toolExecutor.executeToolCalls(
            [{
              id: toolCall.id,
              name: toolCall.name,
              input: toolCall.arguments,
              status: 'queued',
              isConcurrencySafe: false,
              startedAt: Date.now(),
              completedAt: null,
              result: null,
              error: null,
              progress: [],
            }],
            {
              cwd: '',
              signal,
              getAppState: () => ({}),
              setAppState: () => {},
              messages: msgs,
            },
          )

          const executed = result[0]
          if (executed?.error) {
            return { result: '', error: executed.error }
          }
          return { result: executed?.result ?? '', error: undefined }
        } catch (error) {
          return {
            result: '',
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },
    )

    for await (const event of gen) {
      // Track token usage in cost tracker
      if (event.type === 'token_update') {
        const usage = (event as any).usage
        if (usage?.outputTokens) {
          this.costTracker.trackChunk('output', usage.outputTokens)
        }
        if (usage?.inputTokens) {
          this.costTracker.trackChunk('input', usage.inputTokens)
        }
      }

      if (event.type === 'turn_complete' || event.type === 'complete') {
        this.costTracker.finalizeTurn()
      }

      yield event
    }

    // Plugin hooks: after_query
    await pm.emit('after_query', { input, turnNumber })

    // Collect skill discovery results (prefetched concurrent)
    if (skillPrefetch) {
      await collectSkillDiscoveryPrefetch(skillPrefetch)
    }
  }

  getSummary(): string {
    const cost = this.costTracker.getSummary()
    const turns = this.costTracker.getTurns().length
    return `Session: ${turns} turns\n${cost}\nTools: ${this.tools.length}`
  }
}
