import { Message } from '../types'
import { parseToolCallsFromContent } from './ToolPrompt'

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  thinkingTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

export const EMPTY_USAGE: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  thinkingTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
}

export function accumulateUsage(total: TokenUsage, delta: TokenUsage): TokenUsage {
  return {
    promptTokens: total.promptTokens + delta.promptTokens,
    completionTokens: total.completionTokens + delta.completionTokens,
    totalTokens: total.totalTokens + delta.totalTokens,
    thinkingTokens: total.thinkingTokens + delta.thinkingTokens,
    cacheReadTokens: total.cacheReadTokens + delta.cacheReadTokens,
    cacheCreationTokens: total.cacheCreationTokens + delta.cacheCreationTokens,
  }
}

export interface ToolCallRecord {
  id: string
  name: string
  arguments: Record<string, any>
  status: 'queued' | 'executing' | 'completed' | 'failed' | 'cancelled'
  isConcurrencySafe: boolean
  startedAt: number
  completedAt: number | null
  result: string | null
  error: string | null
  progress: string[]
}

export type ContinueReason =
  | 'tool_use'
  | 'max_output_tokens_recovery'
  | 'reactive_compact_retry'
  | 'collapse_drain_retry'
  | 'max_output_tokens_escalate'
  | 'prompt_too_long'
  | 'blocking_limit'
  | 'model_error'
  | 'aborted_streaming'

export interface ToolCallSnapshot {
  name: string
  argsFingerprint: string
  turnNumber: number
}

export interface QueryEngineState {
  messages: Message[]
  turnCount: number
  tokenUsage: TokenUsage
  isRunning: boolean
  isAborted: boolean
  lastToolCalls: ToolCallRecord[]
  compactBoundaryIndex: number | null
  maxOutputTokensRecoveryCount: number
  hasAttemptedReactiveCompact: boolean
  transition: ContinueReason | undefined
  currentMessageUsage: TokenUsage
  lastStopReason: string | null
  // Loop detection
  consecutiveToolOnlyTurns: number
  toolCallHistory: ToolCallSnapshot[]
  lastLoopWarning: number
  forcedComplete: boolean
}

export interface QueryEngineConfig {
  maxTurns: number
  maxBudgetUsd: number
  costPer1KTokens: number
  compactReserveTokens: number
  autocompactBufferTokens: number
  maxConcurrentTools: number
}

export const DEFAULT_CONFIG: QueryEngineConfig = {
  maxTurns: 100,
  maxBudgetUsd: 10,
  costPer1KTokens: 0.015,
  compactReserveTokens: 20_000,
  autocompactBufferTokens: 13_000,
  maxConcurrentTools: 10,
}

export type QueryEvent =
  | { type: 'stream_request_start' }
  | { type: 'stream_event'; chunk: string; isThinking: boolean }
  | { type: 'tool_call_start'; toolCall: ToolCallRecord }
  | { type: 'tool_call_progress'; toolCallId: string; progress: string }
  | { type: 'tool_call_complete'; toolCall: ToolCallRecord }
  | { type: 'tool_call_error'; toolCallId: string; error: string }
  | { type: 'token_update'; usage: TokenUsage }
  | { type: 'turn_complete'; turnCount: number }
  | { type: 'compaction_triggered'; originalCount: number; compactedCount: number; compactedMessages?: import('../types').Message[] }
  | { type: 'budget_warning'; percentage: number }
  | { type: 'error'; error: string }
  | { type: 'complete'; result: string }
  | { type: 'ask_user'; question: string; options?: string[]; requiresResponse: boolean }
  | { type: 'loop_warning'; message: string; toolCallCount: number }
  | { type: 'tool_quality_issue'; issue: string; toolName: string; details: string }
  | { type: 'task_quality'; completionPct: number; hasSummary: boolean; hasConclusion: boolean; toolCallCount: number; productiveRatio: number }

export class QueryEngine {
  private config: QueryEngineConfig
  private state: QueryEngineState
  private listeners: Set<(event: QueryEvent) => void> = new Set()
  private abortController: AbortController

  constructor(config: Partial<QueryEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.state = this.createInitialState()
    this.abortController = new AbortController()
  }

  private createInitialState(): QueryEngineState {
    return {
      messages: [],
      turnCount: 0,
      tokenUsage: { ...EMPTY_USAGE },
      isRunning: false,
      isAborted: false,
      lastToolCalls: [],
      compactBoundaryIndex: null,
      maxOutputTokensRecoveryCount: 0,
      hasAttemptedReactiveCompact: false,
      transition: undefined,
      currentMessageUsage: { ...EMPTY_USAGE },
      lastStopReason: null,
      consecutiveToolOnlyTurns: 0,
      toolCallHistory: [],
      lastLoopWarning: 0,
      forcedComplete: false,
    }
  }

  onEvent(listener: (event: QueryEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: QueryEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event)
      } catch (e) {
        console.error('QueryEngine event listener error:', e)
      }
    })
  }

  getState(): QueryEngineState {
    return { ...this.state }
  }

  getConfig(): QueryEngineConfig {
    return { ...this.config }
  }

  abort(): void {
    this.abortController.abort()
    this.state.isAborted = true
    this.state.isRunning = false
  }

  async *submitMessage(
    prompt: string,
    messages: Message[],
    systemPrompt: string,
    callModel: (
      messages: Message[],
      systemPrompt: string,
      signal: AbortSignal,
    ) => AsyncGenerator<{ content: string; isThinking: boolean; usage?: Partial<TokenUsage> }>,
    executeTool: (
      toolCall: ToolCallRecord,
      signal: AbortSignal,
    ) => Promise<{ result: string; error?: string }>,
  ): AsyncGenerator<QueryEvent> {
    this.knownToolCallKeys = new Set<string>()
    this.state = {
      ...this.createInitialState(),
      messages: [...messages],
      isRunning: true,
      turnCount: this.state.turnCount + 1,
    }

    this.emit({ type: 'stream_request_start' })
    yield { type: 'stream_request_start' }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    }
    this.state.messages.push(userMessage)

    while (true) {
      if (this.state.isAborted || this.abortController.signal.aborted) {
        this.state.isRunning = false
        this.emit({ type: 'error', error: 'Aborted by user' })
        yield { type: 'error', error: 'Aborted by user' }
        return
      }

      if (this.state.turnCount >= this.config.maxTurns) {
        this.state.isRunning = false
        this.emit({ type: 'error', error: `Max turns reached (${this.config.maxTurns})` })
        yield { type: 'error', error: `Max turns reached (${this.config.maxTurns})` }
        return
      }

      const currentCost = (this.state.tokenUsage.totalTokens / 1000) * this.config.costPer1KTokens
      if (currentCost >= this.config.maxBudgetUsd) {
        this.state.isRunning = false
        this.emit({ type: 'error', error: `Budget limit reached ($${currentCost.toFixed(2)})` })
        yield { type: 'error', error: `Budget limit reached ($${currentCost.toFixed(2)})` }
        return
      }

      if (currentCost >= this.config.maxBudgetUsd * 0.8) {
        this.emit({ type: 'budget_warning', percentage: (currentCost / this.config.maxBudgetUsd) * 100 })
        yield { type: 'budget_warning', percentage: (currentCost / this.config.maxBudgetUsd) * 100 }
      }

      const messagesForQuery = await this.runContextPipeline(this.state.messages)

      if (this.shouldCompact(messagesForQuery)) {
        const compacted = await this.runCompaction(messagesForQuery, systemPrompt)
        if (compacted) {
          this.state.messages = compacted
          this.emit({
            type: 'compaction_triggered',
            originalCount: messagesForQuery.length,
            compactedCount: compacted.length,
          })
          yield {
            type: 'compaction_triggered',
            originalCount: messagesForQuery.length,
            compactedCount: compacted.length,
          }
        }
      }

      const messagesWithSystem = systemPrompt
        ? [{ id: 'system', role: 'system' as const, content: systemPrompt, timestamp: Date.now() }, ...messagesForQuery]
        : messagesForQuery

      let assistantContent = ''
      let assistantThinking = ''
      let hasToolCalls = false
      let toolCalls: ToolCallRecord[] = []

      try {
        for await (const chunk of callModel(messagesWithSystem, systemPrompt, this.abortController.signal)) {
          if (this.abortController.signal.aborted) break

          if (chunk.usage) {
            this.state.currentMessageUsage = accumulateUsage(
              this.state.currentMessageUsage,
              chunk.usage as TokenUsage,
            )
            this.emit({ type: 'token_update', usage: this.state.currentMessageUsage })
            yield { type: 'token_update', usage: this.state.currentMessageUsage }
          }

          if (chunk.isThinking) {
            assistantThinking += chunk.content
            this.emit({ type: 'stream_event', chunk: chunk.content, isThinking: true })
            yield { type: 'stream_event', chunk: chunk.content, isThinking: true }
          } else {
            assistantContent += chunk.content
            // Strip <tool_response> blocks the model sometimes generates — these cause
            // infinite loops when fed back as context on the next turn
            assistantContent = assistantContent.replace(/<tool_response>[\s\S]*?<\/tool_response>/gi, '')
            this.emit({ type: 'stream_event', chunk: chunk.content, isThinking: false })
            yield { type: 'stream_event', chunk: chunk.content, isThinking: false }

            const detectedToolCalls = this.detectToolCalls(chunk.content, assistantContent)
            if (detectedToolCalls.length > 0) {
              hasToolCalls = true
              toolCalls = [...toolCalls, ...detectedToolCalls]
            }
          }
        }

        this.state.tokenUsage = accumulateUsage(this.state.tokenUsage, this.state.currentMessageUsage)
        this.state.currentMessageUsage = { ...EMPTY_USAGE }

        // Clean up XML garbage the model generates (<system-reminder>, <action>, etc.)
        let cleanContent = assistantContent
          .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '')
          .replace(/<system-redirect>[\s\S]*?<\/system-redirect>/gi, '')
          .replace(/<system-notice>[\s\S]*?<\/system-notice>/gi, '')
          .replace(/<action>[\s\S]*?<\/action>/gi, '')
          .replace(/<tool_response>[\s\S]*?<\/tool_response>/gi, '')
          .replace(/<os_security_[a-z_]+>[\s\S]*?<\/os_security_[a-z_]+>/gi, '')
          .replace(/<thinking>\s*<\/thinking>/gi, '')
          // Strip properly closed TOOL_CALLS blocks (all variants)
          .replace(/<(?:TOOL_CALLS|TOOL_CALL|tool_call|tool-calls)>[\s\S]*?<\/(?:TOOL_CALLS?|TOOL_CALL|tool_call|tool-calls)>/gi, '')
          // Strip truncated blocks (e.g. </TOOL_CALL\n without final S> before stream error)
          .replace(/<(?:TOOL_CALLS|TOOL_CALL|tool_call|tool-calls)>[\s\S]*?(?=\[Stream|\[Error|$)/gi, '')
          // Strip bare tool tags with mismatched closing tags (e.g. </REPL> instead of </Read>)
          .replace(/<(Read|Write|Edit|Bash|Glob|Grep)\b[^>]*>[\s\S]*?<\/\w+>/gi, '')
          // Strip leftover partial XML tags
          .replace(/<\/?(?:TOOL_CALLS?|TOOL_CALL|tool_call|tool-calls|Read|Write|Edit|Bash|Glob|Grep|system-reminder|system-redirect|system-notice|tool_response|os_security|action|exec)[^>]*>/gi, '')
        // Collapse multiple newlines
        cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n').trim()
        if (!cleanContent && assistantThinking) {
          cleanContent = assistantThinking
        }
        assistantContent = cleanContent

        // Repetition detection: check if model keeps generating same pattern
        const repeatedBlockPattern = /<(\w+)>([\s\S]*?)<\/\1>/g
        const blocks: string[] = []
        let bm: RegExpExecArray | null
        while ((bm = repeatedBlockPattern.exec(assistantContent)) !== null) {
          if (!['TOOL_CALLS', 'tool_call', 'thinking'].includes(bm[1])) continue
          blocks.push(bm[1] + ':' + bm[2].slice(0, 60))
        }
        const blockCounts = new Map<string, number>()
        for (const b of blocks) {
          blockCounts.set(b, (blockCounts.get(b) || 0) + 1)
        }
        const maxRepeat = Math.max(0, ...blockCounts.values())
        const repetitiveLoop = maxRepeat >= 6

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: assistantThinking ? `<thinking>${assistantThinking}</thinking>\n\n${assistantContent}` : assistantContent,
          timestamp: Date.now(),
        }
        this.state.messages.push(assistantMessage)

        if (hasToolCalls && toolCalls.length > 0) {
          this.state.lastToolCalls = toolCalls

          // Loop detection: track info-gathering tool patterns
          const infoTools = ['Read', 'Glob', 'Grep', 'WebFetch']
          const productiveTools = ['Write', 'Edit', 'Bash', 'TodoWrite']
          const hasProductiveTool = toolCalls.some(tc => productiveTools.includes(tc.name))
          const hasInfoOnly = toolCalls.every(tc => infoTools.includes(tc.name))

          // Snapshot tool calls for duplicate detection
          for (const tc of toolCalls) {
            const fp = JSON.stringify(tc.arguments).slice(0, 100)
            this.state.toolCallHistory.push({ name: tc.name, argsFingerprint: fp, turnNumber: this.state.turnCount })
          }

          // Detect tool-only turns (no productive work done)
          const textOnly = assistantContent.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim()
          const hasTextContent = textOnly.length > 100
          if (!hasTextContent && hasInfoOnly && !hasProductiveTool) {
            this.state.consecutiveToolOnlyTurns++
          } else {
            this.state.consecutiveToolOnlyTurns = 0
          }

          // Detect repeated same-tool calls
          const repeatedTools = this.state.toolCallHistory.filter(t =>
            t.name === toolCalls[0]?.name
          )
          const hasDuplicateLoop = repeatedTools.length >= 6

          // Force complete if stuck in a loop (tool spam or repetitive text)
          const loopDetected = this.state.consecutiveToolOnlyTurns >= 4 || hasDuplicateLoop || repetitiveLoop
          if (loopDetected && Date.now() - this.state.lastLoopWarning > 30000) {
            this.state.lastLoopWarning = Date.now()
            this.state.forcedComplete = true
            this.emit({
              type: 'loop_warning',
              message: hasDuplicateLoop
                ? `Repeated ${toolCalls[0].name} call ${repeatedTools.length}x — forcing completion`
                : `${this.state.consecutiveToolOnlyTurns} info-only turns — forcing completion`,
              toolCallCount: toolCalls.length,
            })
            yield {
              type: 'loop_warning',
              message: hasDuplicateLoop
                ? `Repeated ${toolCalls[0].name} call ${repeatedTools.length}x — forcing completion`
                : `${this.state.consecutiveToolOnlyTurns} info-only turns — forcing completion`,
              toolCallCount: toolCalls.length,
            }

            // Skip tool execution and return a summary
            this.state.transition = undefined
            const summary = assistantContent + `\n\n**Task Complete** — Analysis finished (${this.state.turnCount} turns, ${toolCalls.length} tool calls).`
            this.emit({ type: 'turn_complete', turnCount: this.state.turnCount })
            yield { type: 'turn_complete', turnCount: this.state.turnCount }
            this.emit({ type: 'complete', result: summary })
            yield { type: 'complete', result: summary }
            this.state.isRunning = false
            return
          }

          // Execute tools normally
          const toolResults = await this.executeTools(toolCalls, executeTool)

          for (const result of toolResults) {
            const escaped = typeof result === 'string' ? result.replace(/</g, '&lt;').replace(/>/g, '&gt;') : result
            const toolResultMessage: Message = {
              id: crypto.randomUUID(),
              role: 'user',
              content: escaped,
              timestamp: Date.now(),
            }
            this.state.messages.push(toolResultMessage)
          }

          this.knownToolCallKeys = new Set<string>()
          this.state.transition = 'tool_use'
          continue
        }

        this.state.transition = undefined

        // Emit task quality assessment
        const totalTools = this.state.toolCallHistory.length
        const infoTools = this.state.toolCallHistory.filter(t => ['Read', 'Glob', 'Grep', 'WebFetch'].includes(t.name)).length
        const productiveTools = totalTools - infoTools
        const productiveRatio = totalTools > 0 ? productiveTools / totalTools : 0
        const hasSummary = /^#{1,3}\s+(?:Summary|Conclusion|Findings|Key Findings)/im.test(assistantContent) || /\b(?:summary|overview|findings)\b/i.test(assistantContent.slice(-500))
        const hasConclusion = hasSummary || /\b(?:in conclusion|to summarize|i'?ve (?:completed|finished|analyzed|found|identified)|based on (?:my |this |the )?analysis|here (?:are|is) (?:my|the) (?:findings|analysis|results)|overall,|these are the)\b/i.test(assistantContent)

        this.emit({ type: 'task_quality', completionPct: 100, hasSummary, hasConclusion, toolCallCount: totalTools, productiveRatio })
        yield { type: 'task_quality', completionPct: 100, hasSummary, hasConclusion, toolCallCount: totalTools, productiveRatio }

        this.emit({ type: 'turn_complete', turnCount: this.state.turnCount })
        yield { type: 'turn_complete', turnCount: this.state.turnCount }
        this.emit({ type: 'complete', result: assistantContent })
        yield { type: 'complete', result: assistantContent }
        this.state.isRunning = false
        return

      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          this.state.isRunning = false
          this.emit({ type: 'error', error: 'Aborted by user' })
          yield { type: 'error', error: 'Aborted by user' }
          return
        }

        this.state.isRunning = false
        this.emit({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' })
        yield { type: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
        return
      }
    }
  }

  private async runContextPipeline(messages: Message[]): Promise<Message[]> {
    let result = [...messages]
    result = this.applyToolResultBudget(result)
    result = this.snipCompactIfNeeded(result)
    result = this.microcompact(result)
    result = this.applyCollapsesIfNeeded(result)
    return result
  }

  private applyToolResultBudget(messages: Message[]): Message[] {
    const MAX_TOOL_RESULT_CHARS = 10_000
    return messages.map((msg) => {
      if (msg.role === 'user' && msg.content.length > MAX_TOOL_RESULT_CHARS) {
        return {
          ...msg,
          content: msg.content.slice(0, MAX_TOOL_RESULT_CHARS) + '\n\n[Tool result truncated...]',
        }
      }
      return msg
    })
  }

  private snipCompactIfNeeded(messages: Message[]): Message[] {
    const MAX_MESSAGES = 50
    if (messages.length > MAX_MESSAGES) {
      const keep = messages.slice(-MAX_MESSAGES)
      return [
        {
          id: 'snip-marker',
          role: 'system' as const,
          content: `[Older messages snipped for context management]`,
          timestamp: Date.now(),
        },
        ...keep,
      ]
    }
    return messages
  }

  private microcompact(messages: Message[]): Message[] {
    const result: Message[] = []
    let i = 0
    while (i < messages.length) {
      if (
        i < messages.length - 1 &&
        messages[i].role === 'assistant' &&
        messages[i + 1].role === 'user' &&
        messages[i].content.length < 500 &&
        messages[i + 1].content.length < 500
      ) {
        result.push({
          id: messages[i].id,
          role: 'assistant',
          content: messages[i].content + '\n\n[User response: ' + messages[i + 1].content.slice(0, 200) + '...]',
          timestamp: messages[i].timestamp,
        })
        i += 2
      } else {
        result.push(messages[i])
        i++
      }
    }
    return result
  }

  private applyCollapsesIfNeeded(messages: Message[]): Message[] {
    return messages
  }

  private shouldCompact(messages: Message[]): boolean {
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
    const estimatedTokens = Math.ceil(totalChars / 4)
    const threshold = this.config.compactReserveTokens * 2
    return estimatedTokens > threshold
  }

  private async runCompaction(
    _messages: Message[],
    _systemPrompt: string,
  ): Promise<Message[] | null> {
    if (this.state.maxOutputTokensRecoveryCount >= 3) {
      return null
    }
    return null
  }

  private knownToolCallKeys = new Set<string>()

  private detectToolCalls(_chunk: string, fullContent: string): ToolCallRecord[] {
    const toolCalls: ToolCallRecord[] = []

    if (!fullContent.includes('<TOOL_CALLS>')) return toolCalls

    const parsed = parseToolCallsFromContent(fullContent)
    for (const tc of parsed) {
      const key = `${tc.name}:${JSON.stringify(tc.args)}`
      if (this.knownToolCallKeys.has(key)) continue
      this.knownToolCallKeys.add(key)
      toolCalls.push({
        id: crypto.randomUUID(),
        name: tc.name,
        arguments: tc.args,
        status: 'queued',
        isConcurrencySafe: false,
        startedAt: Date.now(),
        completedAt: null,
        result: null,
        error: null,
        progress: [],
      })
    }
    return toolCalls
  }

  private async executeTools(
    toolCalls: ToolCallRecord[],
    executeTool: (toolCall: ToolCallRecord, signal: AbortSignal) => Promise<{ result: string; error?: string }>,
  ): Promise<string[]> {
    const results: string[] = []
    for (const toolCall of toolCalls) {
      toolCall.status = 'executing'
      toolCall.startedAt = Date.now()
      this.emit({ type: 'tool_call_start', toolCall })

      try {
        const { result, error } = await executeTool(toolCall, this.abortController.signal)
        toolCall.status = error ? 'failed' : 'completed'
        toolCall.result = result
        toolCall.error = error || null
        toolCall.completedAt = Date.now()
        this.emit({ type: 'tool_call_complete', toolCall })
        results.push(result)
      } catch (error) {
        toolCall.status = 'failed'
        toolCall.error = error instanceof Error ? error.message : 'Unknown error'
        toolCall.completedAt = Date.now()
        this.emit({ type: 'tool_call_error', toolCallId: toolCall.id, error: toolCall.error })
        results.push(`Error: ${toolCall.error}`)
      }
    }
    return results
  }

  start(messages: Message[]): void {
    this.state = {
      ...this.createInitialState(),
      messages: [...messages],
      isRunning: true,
      turnCount: this.state.turnCount + 1,
    }
    this.emit({ type: 'stream_request_start' })
  }

  incrementTurn(): void {
    this.state.turnCount++
  }
}

export function createQueryEngine(config?: Partial<QueryEngineConfig>): QueryEngine {
  return new QueryEngine(config)
}
