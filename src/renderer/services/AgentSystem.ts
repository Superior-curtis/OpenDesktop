import { Tool, ToolContext } from './Tool'
import { ApiClient } from './ApiClient'
import { parseToolCallsFromContent } from './ToolPrompt'
import { useChatStore } from '../store/chatStore'

export type AgentType = 'explore' | 'general' | 'custom'

export interface AgentDefinition {
  name: string
  type: string
  agentType: AgentType
  description: string
  prompt?: string
  skills?: string[]
  model?: string
  effort?: string
  mcpServers?: string[]
  allowedTools?: string[]
  source: 'bundled' | 'projectSettings' | 'userSettings' | 'plugin'
  loadedFrom: 'agent' | 'plugin'
  maxTurns?: number
}

export interface CacheSafeParams {
  systemPrompt: string
  userContext: Record<string, string>
  systemContext: Record<string, string>
  model: string
  messages: any[]
  tools: any[]
  thinkingConfig?: { budget_tokens: number }
}

export interface ForkContext {
  agentId: string
  agentDefinition: AgentDefinition
  abortSignal: AbortSignal
  parentToolContext: {
    cwd: string
    getAppState: () => any
    setAppState: (fn: (prev: any) => any) => void
    messages: any[]
    agentId?: string
  }
  cacheSafeParams: CacheSafeParams
  customTools?: any[]
}

export interface AgentResult {
  success: boolean
  messages: any[]
  resultText: string
  agentId: string
  usage?: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheCreationTokens: number
  }
}

export type AgentEvent =
  | { type: 'agent_start'; agentId: string; agentType: AgentType; name: string }
  | { type: 'text'; content: string }
  | { type: 'tool_call'; toolCall: { name: string; args: any } }
  | { type: 'tool_result'; toolName: string; content: string; isError?: boolean }
  | { type: 'agent_complete'; agentId: string; duration: number }
  | { type: 'agent_error'; agentId: string; error: string }

const builtInAgents: AgentDefinition[] = [
  {
    name: 'explore',
    type: 'explore',
    agentType: 'explore',
    description: 'Fast agent specialized for exploring codebases, searching files, and answering questions about the codebase. Use for research tasks that require reading files.',
    prompt: 'You are a fast exploration sub-agent. Your purpose is to search the codebase and answer questions by reading files.\n\nRules:\n- Use Glob to find files by pattern\n- Use Grep to search for patterns in files\n- Use Read to read file contents\n- Be concise and direct — just provide the information requested\n- Cite file paths with backticks\n- Do NOT modify any files\n- Do NOT ask questions back to the user',
    source: 'bundled',
    loadedFrom: 'agent',
    maxTurns: 8,
  },
  {
    name: 'general',
    type: 'general',
    agentType: 'general',
    description: 'General-purpose agent for complex multi-step tasks including file editing, code analysis, and research.',
    prompt: 'You are a general-purpose sub-agent. You can perform complex multi-step tasks that involve reading, writing, and analyzing code.\n\nRules:\n- Break down complex tasks into clear steps\n- Use Read, Glob, Grep to understand the codebase first\n- Use Write and Edit to make changes\n- Use Bash to run commands when needed\n- Use TodoWrite to track your progress\n- Be thorough and provide complete solutions\n- Cite file paths with backticks and line numbers',
    source: 'bundled',
    loadedFrom: 'agent',
    maxTurns: 15,
  },
]

const loadedAgents = new Map<string, AgentDefinition>()

for (const agent of builtInAgents) {
  loadedAgents.set(agent.name, agent)
}

export function getAgentDefinitions(): AgentDefinition[] {
  return Array.from(loadedAgents.values())
}

export function getAgentDefinition(name: string): AgentDefinition | undefined {
  return loadedAgents.get(name)
}

export function registerAgentDefinition(def: AgentDefinition): void {
  loadedAgents.set(def.name, def)
}

export interface ForkAgentParams {
  agentDefinition: AgentDefinition
  promptMessages: any[]
  toolUseContext: {
    cwd: string
    getAppState: () => any
    setAppState: (fn: (prev: any) => any) => void
    messages: any[]
    agentId?: string
    options: {
      tools: any[]
      model: string
      maxTokens?: number
      thinkingConfig?: { budget_tokens: number }
    }
  }
  canUseTool: (toolCall: any, context: any) => Promise<any>
  querySource?: string
  model?: string
  availableTools?: any[]
  override?: { agentId?: string }
  signal?: AbortSignal
}

const AGENT_TOOL_SETS: Record<AgentType, string[]> = {
  explore: ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
  general: ['Read', 'Write', 'Glob', 'Grep', 'Bash', 'WebFetch', 'WebSearch', 'TodoWrite', 'AskUserQuestion'],
  custom: ['Read', 'Write', 'Glob', 'Grep', 'Bash', 'WebFetch', 'WebSearch', 'TodoWrite', 'AskUserQuestion'],
}

function filterToolsForAgent(agentType: AgentType, tools: Tool[]): Tool[] {
  const allowedNames = AGENT_TOOL_SETS[agentType]
  return tools.filter(t => allowedNames.includes(t.name))
}

function buildAgentSystemPrompt(agent: AgentDefinition, tools: Tool[]): string {
  const toolListing = tools.map(t => {
    const params = describeSchema(t.inputSchema)
    return `  • ${t.name}: ${t.description}${params ? `\n    Parameters: ${params}` : ''}`
  }).join('\n')

  return `${agent.prompt || `You are a ${agent.agentType} agent.`}

## Available Tools
${toolListing}

## Output Format
- Use <thinking>...</thinking> for reasoning
- Use <TOOL_CALLS>...</TOOL_CALLS> for tool calls with XML format
- When done, summarize what you found`
}

function describeSchema(schema: any): string {
  if (!schema || !schema._def) return ''
  try {
    const shape = schema._def.typeName === 'ZodObject' ? schema._def.shape() : null
    if (!shape) return ''
    return Object.entries(shape).map(([key, val]: [string, any]) => {
      const required = !val._def?.isOptional
      return `${key}${required ? '' : '?'}`
    }).join(', ')
  } catch { return '' }
}

export async function* runAgent(
  params: ForkAgentParams,
): AsyncGenerator<AgentEvent, AgentResult, unknown> {
  const { agentDefinition, promptMessages, toolUseContext, availableTools } = params
  const agentId = params.override?.agentId ?? crypto.randomUUID()
  const abortSignal = params.signal
  const startTime = Date.now()

  const agentMessages: any[] = []
  let resultText = ''
  let success = false

  yield {
    type: 'agent_start',
    agentId,
    agentType: agentDefinition.agentType,
    name: agentDefinition.name,
  }

  try {
    const store = useChatStore.getState()
    const provider = store.providers.find(p => p.id === store.activeProviderId)
    if (!provider) {
      throw new Error('No active provider available for sub-agent')
    }

    const rawTools: Tool[] = availableTools || []
    const agentTools = filterToolsForAgent(agentDefinition.agentType, rawTools)
    const systemPrompt = buildAgentSystemPrompt(agentDefinition, agentTools)

    const client = new ApiClient(provider)
    const messages: any[] = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...promptMessages,
    ]
    const maxTurns = agentDefinition.maxTurns || 10
    const maxRetries = 2

    for (let turn = 0; turn < maxTurns; turn++) {
      if (abortSignal?.aborted) throw new DOMException('Sub-agent aborted', 'AbortError')

      let responseContent = ''
      let lastError: Error | undefined

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        if (attempt > 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 8000)
          yield { type: 'text', content: `\n[Retry ${attempt - 1}/${maxRetries} after ${Math.round(delay)}ms]\n` }
          await new Promise(r => setTimeout(r, delay))
        }
        try {
          const stream = await client.chat(messages, true, false, 0)
          for await (const chunk of stream) {
            if (abortSignal?.aborted) throw new DOMException('Sub-agent aborted', 'AbortError')
            const text = typeof chunk === 'string' ? chunk : (chunk as any).content || ''
            if (text) {
              responseContent += text
              resultText += text
              yield { type: 'text', content: text }
            }
          }
          lastError = undefined
          break
        } catch (err: any) {
          lastError = err
          const isRetriable = err.message?.match(/\b(429|500|502|503|529|timeout|rate|unavailable)\b/i)
          if (!isRetriable || attempt > maxRetries) throw err
        }
      }
      if (lastError) throw lastError

      if (!responseContent.trim()) break

      agentMessages.push({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseContent,
        timestamp: Date.now(),
      })

      const toolCalls = parseToolCallsFromContent(responseContent)
      if (toolCalls.length === 0) {
        resultText = responseContent
        break
      }

      for (const tc of toolCalls) {
        const tool = agentTools.find(t => t.name === tc.name || t.aliases?.includes(tc.name))
        if (!tool) {
          messages.push({
            role: 'user',
            content: `Tool "${tc.name}" is not available for ${agentDefinition.agentType} agent. Available tools: ${agentTools.map(t => t.name).join(', ')}`,
          })
          continue
        }

        // Permission check
        if (params.canUseTool) {
          const permission = await params.canUseTool(tc, { agentId, turn })
          if (!permission.allowed) {
            messages.push({
              role: 'user',
              content: `Tool "${tc.name}" execution denied: ${permission.reason || 'No reason provided'}`,
            })
            yield { type: 'tool_result', toolName: tc.name, content: `Permission denied: ${permission.reason || 'No reason'}`, isError: true }
            continue
          }
        }

        yield { type: 'tool_call', toolCall: { name: tc.name, args: tc.args } }

        try {
          const toolContext: ToolContext = {
            cwd: toolUseContext.cwd,
            signal: abortSignal || new AbortController().signal,
            getAppState: toolUseContext.getAppState,
            setAppState: toolUseContext.setAppState,
            messages: agentMessages,
            agentId,
          }

          const result = await tool.call(tc.args, toolContext)
          messages.push({ role: 'user', content: result.content })

          yield { type: 'tool_result', toolName: tc.name, content: result.content, isError: result.isError }
        } catch (err: any) {
          messages.push({ role: 'user', content: `Tool "${tc.name}" error: ${err.message || err}` })
          yield { type: 'tool_result', toolName: tc.name, content: err.message || String(err), isError: true }
        }
      }
    }

    success = true
  } catch (error: any) {
    yield { type: 'agent_error', agentId, error: error.message || 'Unknown error' }
    resultText = `Agent "${agentDefinition.name}" failed: ${error.message}`
  }

  yield { type: 'agent_complete', agentId, duration: Date.now() - startTime }

  return {
    success,
    messages: agentMessages,
    resultText,
    agentId,
  }
}

export function extractResultText(
  messages: any[],
  fallback: string = 'No result',
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'assistant' && msg.content) {
      if (typeof msg.content === 'string') return msg.content
      if (Array.isArray(msg.content)) {
        const textBlocks = msg.content.filter((c: any) => c.type === 'text')
        if (textBlocks.length > 0) {
          return textBlocks.map((c: any) => c.text).join('\n')
        }
      }
    }
  }
  return fallback
}

export async function prepareForkedCommandContext(
  command: { name: string; content: string; skillRoot?: string; allowedTools?: string[] },
  args: string,
  context: { cwd: string; getAppState: () => any; setAppState: (fn: (prev: any) => any) => void; options: { tools: any[]; model: string } },
): Promise<{
  modifiedGetAppState: () => any
  baseAgent: AgentDefinition
  promptMessages: any[]
  skillContent: string
}> {
  const skillContent = command.content
  const substitutedContent = args ? `${skillContent}\n\nArguments:\n${args}` : skillContent

  const promptMessages = [
    {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: substitutedContent,
      timestamp: Date.now(),
    },
  ]

  const baseAgent: AgentDefinition = {
    name: command.name,
    type: 'custom',
    agentType: 'custom',
    description: `Skill: ${command.name}`,
    source: 'projectSettings',
    loadedFrom: 'plugin',
    allowedTools: command.allowedTools,
    prompt: `You are executing the "${command.name}" skill. Follow its instructions carefully.`,
  }

  return {
    modifiedGetAppState: context.getAppState,
    baseAgent,
    promptMessages,
    skillContent: substitutedContent,
  }
}
