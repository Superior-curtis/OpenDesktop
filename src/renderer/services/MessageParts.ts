const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export type PartType = 'text' | 'reasoning' | 'tool' | 'file' | 'step-start' | 'step-finish' | 'compaction' | 'retry' | 'agent'

export interface TextPart { type: 'text'; text: string; synthetic?: boolean; hidden?: boolean }
export interface ReasoningPart { type: 'reasoning'; content: string; isThinking?: boolean; isSignature?: boolean }
export interface ToolPart { type: 'tool'; toolName: string; toolCallId: string; state: 'pending' | 'running' | 'completed' | 'error'; input?: Record<string, any>; result?: string; error?: string; startedAt?: number; completedAt?: number; isConcurrencySafe?: boolean }
export interface FilePart { type: 'file'; uri: string; mime: string; name?: string; content?: string; size?: number }
export interface StepStartPart { type: 'step-start'; step: number; snapshot?: any }
export interface StepFinishPart { type: 'step-finish'; step: number; cost?: number; tokens?: { input: number; output: number }; finishReason?: string }
export interface CompactionPart { type: 'compaction'; summary: string; originalCount: number; compactedCount: number; tokensFreed: number }
export interface RetryPart { type: 'retry'; attempt: number; error: string; maxRetries: number }
export interface AgentPart { type: 'agent'; name: string; prompt: string; model?: string }

export type MessagePart = TextPart | ReasoningPart | ToolPart | FilePart | StepStartPart | StepFinishPart | CompactionPart | RetryPart | AgentPart

export class PartBuilder {
  static text(text: string, opts?: { synthetic?: boolean; hidden?: boolean }): TextPart {
    return {
      type: 'text',
      text,
      ...(opts?.synthetic !== undefined ? { synthetic: opts.synthetic } : {}),
      ...(opts?.hidden !== undefined ? { hidden: opts.hidden } : {}),
    }
  }

  static reasoning(content: string, opts?: { isThinking?: boolean; isSignature?: boolean }): ReasoningPart {
    return {
      type: 'reasoning',
      content,
      ...(opts?.isThinking !== undefined ? { isThinking: opts.isThinking } : {}),
      ...(opts?.isSignature !== undefined ? { isSignature: opts.isSignature } : {}),
    }
  }

  static toolCall(toolName: string, toolCallId: string, input: Record<string, any>): ToolPart {
    return {
      type: 'tool',
      toolName,
      toolCallId,
      state: 'pending',
      input,
      startedAt: Date.now(),
    }
  }

  static toolResult(toolCallId: string, result: string): ToolPart {
    return {
      type: 'tool',
      toolName: '',
      toolCallId,
      state: 'completed',
      result,
      completedAt: Date.now(),
    }
  }

  static toolError(toolCallId: string, error: string): ToolPart {
    return {
      type: 'tool',
      toolName: '',
      toolCallId,
      state: 'error',
      error,
      completedAt: Date.now(),
    }
  }

  static file(uri: string, mime: string, opts?: { name?: string; content?: string; size?: number }): FilePart {
    return {
      type: 'file',
      uri,
      mime,
      ...(opts?.name !== undefined ? { name: opts.name } : {}),
      ...(opts?.content !== undefined ? { content: opts.content } : {}),
      ...(opts?.size !== undefined ? { size: opts.size } : {}),
    }
  }

  static stepStart(step: number): StepStartPart {
    return { type: 'step-start', step }
  }

  static stepFinish(step: number, opts?: { cost?: number; tokens?: { input: number; output: number }; finishReason?: string }): StepFinishPart {
    return {
      type: 'step-finish',
      step,
      ...(opts?.cost !== undefined ? { cost: opts.cost } : {}),
      ...(opts?.tokens !== undefined ? { tokens: opts.tokens } : {}),
      ...(opts?.finishReason !== undefined ? { finishReason: opts.finishReason } : {}),
    }
  }

  static compaction(summary: string, originalCount: number, compactedCount: number, tokensFreed: number): CompactionPart {
    return { type: 'compaction', summary, originalCount, compactedCount, tokensFreed }
  }

  static retry(attempt: number, error: string, maxRetries: number): RetryPart {
    return { type: 'retry', attempt, error, maxRetries }
  }

  static agent(name: string, prompt: string, model?: string): AgentPart {
    return {
      type: 'agent',
      name,
      prompt,
      ...(model !== undefined ? { model } : {}),
    }
  }
}

export interface RichMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  parts: MessagePart[]
  timestamp: number
  parentId?: string
  model?: string
  provider?: string
  agent?: string
  cost?: number
  tokens?: { input: number; output: number; reasoning?: number }
  finishReason?: string
  error?: string
  summary?: boolean
}

export function toSimpleMessage(msg: RichMessage): { role: string; content: string } {
  return {
    role: msg.role,
    content: flattenParts(msg.parts),
  }
}

export function fromSimpleMessage(msg: { role: string; content: string; id?: string; timestamp?: number }): RichMessage {
  return {
    id: msg.id ?? generateId(),
    role: msg.role as RichMessage['role'],
    parts: [PartBuilder.text(msg.content)],
    timestamp: msg.timestamp ?? Date.now(),
  }
}

export function flattenParts(parts: MessagePart[]): string {
  const result: string[] = []
  for (const part of parts) {
    if (part.type === 'text') result.push(part.text)
    else if (part.type === 'reasoning') result.push(part.content)
    else if (part.type === 'tool') {
      if (part.result) result.push(`[Tool ${part.toolName}: ${part.result}]`)
      else if (part.error) result.push(`[Tool ${part.toolName} error: ${part.error}]`)
      else result.push(`[Tool ${part.toolName}: ${part.state}]`)
    } else if (part.type === 'file') result.push(`[File: ${part.name ?? part.uri}]`)
    else if (part.type === 'agent') result.push(`[Agent: ${part.name}]`)
    else if (part.type === 'compaction') result.push(`[Compaction: ${part.summary}]`)
    else if (part.type === 'retry') result.push(`[Retry ${part.attempt}/${part.maxRetries}: ${part.error}]`)
  }
  return result.join('\n')
}

export function getToolCalls(parts: MessagePart[]): ToolPart[] {
  return parts.filter((p): p is ToolPart => p.type === 'tool')
}

export function getTextContent(parts: MessagePart[]): string {
  return parts.filter((p): p is TextPart => p.type === 'text').map(p => p.text).join('')
}

export function getReasoningContent(parts: MessagePart[]): string {
  return parts.filter((p): p is ReasoningPart => p.type === 'reasoning').map(p => p.content).join('')
}

export function hasActiveTools(parts: MessagePart[]): boolean {
  return parts.some((p): p is ToolPart => p.type === 'tool' && (p.state === 'pending' || p.state === 'running'))
}

export class StreamingMessageBuilder {
  private parts: MessagePart[] = []
  private currentText: string = ''
  private currentReasoning: string = ''
  private toolBuilders: Map<string, { toolName: string; input: string; startedAt: number }> = new Map()

  startText(): void {
    this.currentText = ''
  }

  appendText(chunk: string): void {
    this.currentText += chunk
  }

  endText(): TextPart {
    const part: TextPart = { type: 'text', text: this.currentText }
    this.parts.push(part)
    this.currentText = ''
    return part
  }

  startReasoning(): void {
    this.currentReasoning = ''
  }

  appendReasoning(chunk: string): void {
    this.currentReasoning += chunk
  }

  endReasoning(): ReasoningPart {
    const part: ReasoningPart = { type: 'reasoning', content: this.currentReasoning }
    this.parts.push(part)
    this.currentReasoning = ''
    return part
  }

  startToolCall(toolCallId: string, toolName: string): void {
    this.toolBuilders.set(toolCallId, { toolName, input: '', startedAt: Date.now() })
  }

  appendToolInput(toolCallId: string, chunk: string): void {
    const builder = this.toolBuilders.get(toolCallId)
    if (builder) {
      builder.input += chunk
    }
  }

  completeToolCall(toolCallId: string, result: string): ToolPart {
    const builder = this.toolBuilders.get(toolCallId)
    let input: Record<string, any> | undefined
    try {
      input = builder ? JSON.parse(builder.input) : undefined
    } catch {
      input = undefined
    }
    const now = Date.now()
    const part: ToolPart = {
      type: 'tool',
      toolName: builder?.toolName ?? '',
      toolCallId,
      state: 'completed',
      input,
      result,
      startedAt: builder?.startedAt ?? now,
      completedAt: now,
    }
    this.parts.push(part)
    this.toolBuilders.delete(toolCallId)
    return part
  }

  failToolCall(toolCallId: string, error: string): ToolPart {
    const builder = this.toolBuilders.get(toolCallId)
    let input: Record<string, any> | undefined
    try {
      input = builder ? JSON.parse(builder.input) : undefined
    } catch {
      input = undefined
    }
    const now = Date.now()
    const part: ToolPart = {
      type: 'tool',
      toolName: builder?.toolName ?? '',
      toolCallId,
      state: 'error',
      input,
      error,
      startedAt: builder?.startedAt ?? now,
      completedAt: now,
    }
    this.parts.push(part)
    this.toolBuilders.delete(toolCallId)
    return part
  }

  getParts(): MessagePart[] {
    return [...this.parts]
  }

  build(): RichMessage {
    return {
      id: generateId(),
      role: 'assistant',
      parts: [...this.parts],
      timestamp: Date.now(),
    }
  }

  reset(): void {
    this.parts = []
    this.currentText = ''
    this.currentReasoning = ''
    this.toolBuilders.clear()
  }
}

export function toModelMessages(
  messages: RichMessage[],
  opts?: { filterCompacted?: boolean; stripReasoning?: boolean },
): Array<Record<string, any>> {
  const result: Array<Record<string, any>> = []

  for (const msg of messages) {
    if (opts?.filterCompacted && msg.summary) continue

    const parts = msg.parts.filter(p => {
      if (p.type === 'text') return !p.hidden
      if (p.type === 'reasoning') return !opts?.stripReasoning
      return true
    })

    if (parts.length === 0) continue

    for (const p of parts) {
      if (p.type !== 'compaction') continue
      result.push({
        role: 'system',
        content: `[Context compressed: ${p.summary}]`,
      })
    }

    const contentParts = parts.filter(p => p.type !== 'compaction')
    if (contentParts.length === 0) continue

    const toolParts = contentParts.filter((p): p is ToolPart => p.type === 'tool')

    if (msg.role === 'user') {
      const content: any[] = []
      for (const p of contentParts) {
        if (p.type === 'text') {
          content.push({ type: 'text', text: p.text })
        } else if (p.type === 'file') {
          if (p.mime.startsWith('image/')) {
            content.push({ type: 'image_url', image_url: { url: p.uri } })
          } else {
            content.push({ type: 'text', text: `[File: ${p.name ?? p.uri}]` })
          }
        } else if (p.type === 'reasoning') {
          content.push({ type: 'text', text: p.content })
        }
      }
      if (content.length > 0) {
        result.push({
          role: 'user',
          content: content.length === 1 ? content[0].text : content,
        })
      }
    } else if (msg.role === 'assistant') {
      const assistantContent: any[] = []
      const toolResults: Array<{ toolCallId: string; content: string }> = []

      for (const p of contentParts) {
        if (p.type === 'text') {
          // Strip embedded tool call markup from text to prevent NVIDIA NIM
          // from server-side parsing invalid patterns that cause 400 errors.
          let clean = p.text
            // Strip properly closed <TOOL_CALLS> blocks (all variants)
            .replace(/<(?:TOOL_CALLS|TOOL_CALL|tool_call|tool-calls)>[\s\S]*?<\/(?:TOOL_CALLS?|TOOL_CALL|tool_call|tool-calls)>/gi, '')
            // Strip truncated blocks (e.g. </TOOL_CALL\n without final S> before stream error)
            .replace(/<(?:TOOL_CALLS|TOOL_CALL|tool_call|tool-calls)>[\s\S]*?(?=\[Stream|\[Error|$)/gi, '')
            // Strip stream interruption artifacts before they pollute the API request
            .replace(/\[(?:Stream|Response) interrupted[^\]]*\]/g, '')
            // Strip bare tool tags outside <TOOL_CALLS>
            .replace(/<(Read|Write|Edit|Bash|Glob|Grep|WebFetch|WebSearch|TodoWrite|AskUserQuestion|Agent|Skill|task)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
            // Strip bare tool tags with mismatched closing tags (e.g. </REPL> instead of </Read>)
            .replace(/<(Read|Write|Edit|Bash|Glob|Grep)\b[^>]*>[\s\S]*?<\/\w+>/gi, '')
            // Strip hallucinated XML tags the model generates
            .replace(/<(system-reminder|system-redirect|system-notice|system-instruction|action|tool_response|os_security_[a-z_]+|final|answer|output|result|function|exec|command|script|response|completion)[^>]*>[\s\S]*?<\/\1>/gi, '')
          // Strip leftover tool-like tags that survived regexes (partial/hallucinated, with or without closing >)
          clean = clean.replace(/<\/?(?:TOOL_CALLS?|TOOL_CALL|tool_call|tool-calls|Read|Write|Edit|Bash|Glob|Grep|system-reminder|system-redirect|system-notice|system-instruction|tool_response|os_security|action|exec|final|answer|output|result|function|command|script|response|completion)[^>]*>?/gi, '')
          if (clean) {
            assistantContent.push({ type: 'text', text: clean })
          }
        } else if (p.type === 'reasoning') {
          assistantContent.push({ type: 'text', text: p.content })
        } else if (p.type === 'tool') {
          if (p.state === 'completed' || p.state === 'error') {
            toolResults.push({
              toolCallId: p.toolCallId,
              content: p.state === 'completed' ? (p.result ?? '') : (p.error ?? ''),
            })
          } else {
            assistantContent.push({
              type: 'tool_use',
              id: p.toolCallId,
              name: p.toolName,
              input: p.input ?? {},
            })
          }
        }
      }

      if (assistantContent.length > 0 || toolParts.length > 0) {
        result.push({
          role: 'assistant',
          content: assistantContent,
        })
      }

      for (const tr of toolResults) {
        result.push({
          role: 'tool',
          tool_call_id: tr.toolCallId,
          content: tr.content,
        })
      }
    } else if (msg.role === 'system') {
      const text = contentParts
        .filter((p): p is TextPart => p.type === 'text')
        .map(p => p.text)
        .join('')
      if (text) {
        result.push({ role: 'system', content: text })
      }
    }
  }

  return result
}
