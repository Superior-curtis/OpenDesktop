export type ProviderID = 'anthropic' | 'openai' | 'google' | 'opencode' | 'opencode-zen' | 'openrouter' | 'azure' | 'bedrock' | 'xai' | 'github-copilot' | 'litellm' | 'custom'

export type ModelVariant = 'default' | 'thinking' | 'fast' | 'chat' | 'responses'

export interface TransformContext {
  provider: ProviderID
  model: string
  variant: ModelVariant
  hasThinking: boolean
  hasTools: boolean
  hasVision: boolean
}

const GOOGLE_GEMINI_MODELS = ['gemini']
const OPENAI_MODEL_PREFIXES = ['gpt', 'o1', 'o3', 'o4']
const REASONING_MODEL_PATTERNS = [/^(o1|o3|o4)/, /thinking$/, /reasoner$/, /r1/, /qwq/, /ultra/i, /deepseek-reasoner/]
const SMALL_MODEL_PATTERNS = [/mini/, /small/, /nano/, /flash/, /haiku/, /light/, /compact/, /fast$/]
const MEDIA_PROVIDER_SUPPORT: Record<ProviderID, { image: boolean; audio: boolean; video: boolean; pdf: boolean }> = {
  anthropic: { image: true, audio: false, video: false, pdf: true },
  openai: { image: true, audio: true, video: false, pdf: true },
  google: { image: true, audio: true, video: true, pdf: false },
  opencode: { image: true, audio: false, video: false, pdf: false },
  'opencode-zen': { image: true, audio: false, video: false, pdf: false },
  openrouter: { image: true, audio: true, video: false, pdf: true },
  azure: { image: true, audio: true, video: false, pdf: true },
  bedrock: { image: true, audio: false, video: false, pdf: true },
  xai: { image: true, audio: false, video: false, pdf: false },
  'github-copilot': { image: true, audio: false, video: false, pdf: false },
  litellm: { image: true, audio: true, video: false, pdf: true },
  custom: { image: true, audio: true, video: true, pdf: true },
}

function isGoogleModel(model: string): boolean {
  const lower = model.toLowerCase()
  return GOOGLE_GEMINI_MODELS.some((prefix) => lower.includes(prefix))
}

function isOpenAIModel(model: string): boolean {
  const lower = model.toLowerCase()
  return OPENAI_MODEL_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

function scrubToolCallId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function stripEmptyContent(msgs: Array<{ role: string; content: any }>): Array<{ role: string; content: any }> {
  return msgs
    .map((msg) => {
      if (typeof msg.content === 'string') {
        if (msg.content === '') return undefined
        return msg
      }
      if (!Array.isArray(msg.content)) return msg
      const filtered = msg.content.filter((part: any) => {
        if (part.type === 'text' || part.type === 'reasoning') {
          return part.text != null && part.text !== ''
        }
        if (part.type === 'thinking') {
          return part.content != null && part.content !== ''
        }
        return true
      })
      if (filtered.length === 0) return undefined
      return { ...msg, content: filtered }
    })
    .filter((msg): msg is { role: string; content: any } => msg != null)
}

function reorderToolUseBlocks(msgs: Array<{ role: string; content: any }>): Array<{ role: string; content: any }> {
  return msgs.flatMap((msg) => {
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) return [msg]
    const parts = msg.content
    const first = parts.findIndex((part: any) => part.type === 'tool_use' || part.type === 'tool-call')
    if (first === -1) return [msg]
    if (!parts.slice(first).some((part: any) => part.type !== 'tool_use' && part.type !== 'tool-call')) return [msg]
    return [
      { ...msg, content: parts.filter((part: any) => part.type !== 'tool_use' && part.type !== 'tool-call') },
      { ...msg, content: parts.filter((part: any) => part.type === 'tool_use' || part.type === 'tool-call') },
    ]
  })
}

function normalizeContentArray(
  msgs: Array<{ role: string; content: any }>,
): Array<{ role: string; content: any }> {
  return msgs.map((msg) => {
    if (msg.role !== 'assistant') return msg
    if (typeof msg.content !== 'string') return msg
    if (msg.content === '') return { ...msg, content: [] }
    return { ...msg, content: [{ type: 'text', text: msg.content }] }
  })
}

function applyAnthropicTransforms(
  msgs: Array<{ role: string; content: any }>,
  _context: TransformContext,
): Array<{ role: string; content: any }> {
  msgs = stripEmptyContent(msgs)
  msgs = msgs.map((msg) => {
    if (!Array.isArray(msg.content)) return msg
    return {
      ...msg,
      content: msg.content.map((part: any) => {
        if (part.type === 'tool_use' || part.type === 'tool-call' || part.type === 'tool-result') {
          return { ...part, id: part.id ? scrubToolCallId(part.id) : part.id, toolCallId: part.toolCallId ? scrubToolCallId(part.toolCallId) : part.toolCallId }
        }
        return part
      }),
    }
  })
  msgs = reorderToolUseBlocks(msgs)
  return msgs
}

function applyOpenAITransforms(
  msgs: Array<{ role: string; content: any }>,
  context: TransformContext,
): Array<{ role: string; content: any }> {
  msgs = normalizeContentArray(msgs)
  return msgs.map((msg) => {
    if (!Array.isArray(msg.content)) return msg
    if (msg.content.some((part: any) => part.type === 'thinking')) {
      return {
        ...msg,
        content: msg.content.map((part: any) => {
          if (part.type === 'thinking') {
            return { type: 'text', text: part.content ?? part.text ?? '' }
          }
          if (part.type === 'reasoning' && context.hasThinking) {
            return { ...part, type: 'reasoning' }
          }
          return part
        }),
      }
    }
    return msg
  })
}

/**
 * Merge consecutive role:'user' messages into a single user message.
 * Some API providers (e.g. Qwen on NVIDIA NIM) reject consecutive user messages.
 * Combines text content with '\n\n' separator as a plain string (Qwen-compatible).
 */
function mergeConsecutiveUserMessages(
  msgs: Array<{ role: string; content: any }>,
): Array<{ role: string; content: any }> {
  const result: Array<{ role: string; content: any }> = []
  for (const msg of msgs) {
    if (result.length > 0 && msg.role === 'user' && result[result.length - 1].role === 'user') {
      const prev = result[result.length - 1]
      const prevText = Array.isArray(prev.content) ? prev.content.map((p: any) => p.text ?? JSON.stringify(p)).join('\n') : (typeof prev.content === 'string' ? prev.content : JSON.stringify(prev.content))
      const currText = Array.isArray(msg.content) ? msg.content.map((p: any) => p.text ?? JSON.stringify(p)).join('\n') : (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))
      result[result.length - 1] = { ...prev, content: prevText + '\n\n' + currText }
    } else {
      result.push(msg)
    }
  }
  return result
}

function applyGoogleTransforms(
  msgs: Array<{ role: string; content: any }>,
  context: TransformContext,
): Array<{ role: string; content: any }> {
  if (!context.hasThinking) return msgs
  return msgs.map((msg) => {
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) return msg
    const reasoningParts = msg.content.filter((part: any) => part.type === 'reasoning')
    const thinkingText = reasoningParts.map((part: any) => part.text ?? part.content ?? '').join('')
    const filtered = msg.content.filter((part: any) => part.type !== 'reasoning')
    if (thinkingText) {
      filtered.push({ type: 'thinking', content: thinkingText, mimeType: 'text/plain' })
    }
    return { ...msg, content: filtered }
  })
}

export function transformMessages(
  messages: Array<{ role: string; content: any }>,
  context: TransformContext,
): Array<{ role: string; content: any }> {
  let msgs = [...messages]

  switch (context.provider) {
    case 'anthropic':
      msgs = applyAnthropicTransforms(msgs, context)
      break
    case 'openai':
    case 'azure':
      msgs = applyOpenAITransforms(msgs, context)
      break
    case 'litellm':
      msgs = applyOpenAITransforms(msgs, context)
      // Tool results are stored as role:'user' with object content — stringify all content
      msgs = msgs.map((m) => ({
        ...m,
        content: typeof m.content === 'string' ? m.content
          : Array.isArray(m.content) ? m.content
          : JSON.stringify(m.content ?? ''),
      }))
      msgs = mergeConsecutiveUserMessages(msgs)
      break
    case 'google':
      msgs = applyGoogleTransforms(msgs, context)
      break
    case 'bedrock':
      msgs = stripEmptyContent(msgs)
      break
    case 'opencode':
      msgs = applyOpenAITransforms(msgs, context)
      break
    case 'custom':
      msgs = applyGoogleTransforms(msgs, context)
      break
  }

  return msgs
}

export function transformSystemPrompt(prompt: string, context: TransformContext): string {
  switch (context.provider) {
    case 'anthropic':
      return prompt
    case 'google':
      return prompt
    case 'openai':
    case 'azure':
      if (prompt.length === 0) return prompt
      return prompt
    default:
      return prompt
  }
}

export function extractThinkingContent(
  messages: Array<{ role: string; content: any }>,
  provider: ProviderID,
): Array<{ role: string; content: any }> {
  if (provider !== 'google' && provider !== 'custom') return messages

  return messages.map((msg) => {
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) return msg
    const thinkingParts = msg.content.filter((part: any) => part.type === 'thinking')
    const otherParts = msg.content.filter((part: any) => part.type !== 'thinking')
    return {
      ...msg,
      content: otherParts,
      thinking: thinkingParts.map((part: any) => ({
        content: part.content ?? part.text ?? '',
        mimeType: part.mimeType ?? 'text/plain',
      })),
    }
  })
}

export function injectThinkingTags(content: string, provider: ProviderID): string {
  switch (provider) {
    case 'anthropic':
      return content
    case 'google':
    case 'custom':
      return content.replace(/```thinking\s*\n/g, '<thinking>\n').replace(/\n```\s*<\/thinking>/g, '\n</thinking>')
    case 'openai':
      return content
    default:
      return content
  }
}

export function stripThinking(content: string, provider: ProviderID): string {
  switch (provider) {
    case 'anthropic':
      return content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim()
    case 'google':
    case 'custom':
      return content
        .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
        .replace(/```thinking[\s\S]*?```/g, '')
        .trim()
    case 'openai':
      return content
    default:
      return content
  }
}

export function normalizeToolCalls(
  toolCalls: any[],
  provider: ProviderID,
): Array<{ id: string; name: string; arguments: Record<string, any> }> {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return []

  switch (provider) {
    case 'openai':
    case 'azure':
    case 'xai':
    case 'litellm': {
      return toolCalls.map((tc) => {
        if (tc.function) {
          return {
            id: tc.id ?? '',
            name: tc.function.name ?? '',
            arguments: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : (tc.function.arguments ?? {}),
          }
        }
        return {
          id: tc.id ?? '',
          name: tc.name ?? tc.function?.name ?? '',
          arguments: typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : (tc.arguments ?? {}),
        }
      })
    }

    case 'anthropic':
    case 'google':
    case 'bedrock': {
      return toolCalls.map((tc) => ({
        id: tc.id ?? tc.toolCallId ?? '',
        name: tc.name ?? tc.toolName ?? tc.function?.name ?? '',
        arguments: typeof tc.input === 'object' && tc.input !== null ? tc.input : (typeof tc.arguments === 'object' ? tc.arguments : {}),
      }))
    }

    case 'opencode':
      return toolCalls.map((tc) => ({
        id: tc.id ?? tc.toolCallId ?? '',
        name: tc.name ?? tc.toolName ?? '',
        arguments: typeof tc.input === 'object' && tc.input !== null ? tc.input : (typeof tc.arguments === 'object' ? tc.arguments : {}),
      }))

    default:
      return toolCalls.map((tc) => ({
        id: tc.id ?? '',
        name: tc.name ?? tc.toolName ?? '',
        arguments: tc.arguments ?? tc.input ?? {},
      }))
  }
}

export function normalizeToolResults(results: any[], provider: ProviderID): any[] {
  if (!Array.isArray(results) || results.length === 0) return []

  switch (provider) {
    case 'openai':
    case 'azure':
    case 'xai':
    case 'litellm':
      return results.map((r) => ({
        role: 'tool',
        tool_call_id: r.toolCallId ?? r.id ?? '',
        content: typeof r.content === 'string' ? r.content : (r.result ?? JSON.stringify(r.content ?? '')),
      }))

    case 'anthropic':
      return results.map((r) => ({
        type: 'tool_result',
        tool_use_id: r.toolCallId ?? r.id ?? '',
        content: typeof r.content === 'string' ? r.content : (r.result ?? JSON.stringify(r.content ?? '')),
      }))

    case 'google':
      return results.map((r) => ({
        type: 'functionResponse',
        name: r.name ?? r.toolName ?? '',
        response: {
          name: r.name ?? r.toolName ?? '',
          content: typeof r.content === 'string' ? r.content : (r.result ?? JSON.stringify(r.content ?? '')),
        },
      }))

    case 'bedrock':
      return results.map((r) => ({
        toolUseId: r.toolCallId ?? r.id ?? '',
        content: typeof r.content === 'string' ? r.content : (r.result ?? JSON.stringify(r.content ?? '')),
      }))

    default:
      return results.map((r) => ({
        tool_call_id: r.toolCallId ?? r.id ?? '',
        content: typeof r.content === 'string' ? r.content : (r.result ?? JSON.stringify(r.content ?? '')),
      }))
  }
}

export interface MediaTransformResult {
  inline: boolean
  data?: string
  url?: string
  mimeType: string
}

export function transformMediaForProvider(
  media: { mimeType: string; data?: string; url?: string },
  provider: ProviderID,
): MediaTransformResult {
  const result: MediaTransformResult = { inline: true, mimeType: media.mimeType }

  switch (provider) {
    case 'anthropic':
      if (media.data) {
        result.data = media.data
        result.inline = true
      } else if (media.url) {
        result.url = media.url
        result.inline = false
      }
      return result

    case 'openai':
    case 'azure':
      if (media.data) {
        result.data = `data:${media.mimeType};base64,${media.data}`
        result.inline = true
      } else if (media.url) {
        result.url = media.url
        result.inline = false
      }
      return result

    case 'google':
      if (media.data) {
        result.data = media.data
        result.inline = true
      } else if (media.url) {
        result.url = media.url
        result.inline = false
      }
      return result

    default:
      if (media.data) {
        result.data = media.data
        result.inline = true
      } else if (media.url) {
        result.url = media.url
        result.inline = false
      }
      return result
  }
}

export function supportsMediaType(mimeType: string, provider: ProviderID): boolean {
  const support = MEDIA_PROVIDER_SUPPORT[provider] ?? MEDIA_PROVIDER_SUPPORT.custom
  if (mimeType.startsWith('image/')) return support.image
  if (mimeType.startsWith('audio/')) return support.audio
  if (mimeType.startsWith('video/')) return support.video
  if (mimeType === 'application/pdf') return support.pdf
  return false
}

export function supportsToolCalling(_model: string, provider: ProviderID): boolean {
  switch (provider) {
    case 'anthropic':
    case 'openai':
    case 'google':
    case 'opencode':
    case 'opencode-zen':
    case 'openrouter':
    case 'azure':
    case 'xai':
    case 'bedrock':
    case 'github-copilot':
    case 'litellm':
    case 'custom':
      return true
  }
}

export function supportsThinking(model: string, provider: ProviderID): boolean {
  const lower = model.toLowerCase()
  switch (provider) {
    case 'anthropic':
      return true
    case 'openai':
    case 'azure':
    case 'litellm':
      return isOpenAIModel(model) && REASONING_MODEL_PATTERNS.some((p) => p.test(lower))
    case 'google':
      return isGoogleModel(model)
    case 'opencode':
    case 'opencode-zen':
      return lower.includes('qwen') || lower.includes('deepseek')
    case 'openrouter':
      return REASONING_MODEL_PATTERNS.some((p) => p.test(lower)) || lower.includes('claude')
    case 'xai':
      return lower.includes('grok-3') || lower.includes('grok-thinking')
    case 'bedrock':
      return lower.includes('claude') || lower.includes('nova')
    case 'github-copilot':
      return lower.includes('claude') || lower.includes('gpt')
    case 'custom':
      return true
  }
}

export function supportsVision(provider: ProviderID): boolean {
  return MEDIA_PROVIDER_SUPPORT[provider]?.image ?? true
}

export function supportsStreaming(provider: ProviderID): boolean {
  switch (provider) {
    case 'anthropic':
    case 'openai':
    case 'google':
    case 'opencode':
    case 'opencode-zen':
    case 'openrouter':
    case 'azure':
    case 'bedrock':
    case 'xai':
    case 'github-copilot':
    case 'litellm':
    case 'custom':
      return true
  }
}

const MODEL_FAMILIES: Record<string, RegExp> = {
  'claude-sonnet': /claude.*sonnet|sonnet/i,
  'claude-opus': /claude.*opus|opus/i,
  'claude-haiku': /claude.*haiku|haiku/i,
  'gpt-4o': /gpt-4o/i,
  'gpt-4o-mini': /gpt-4o-mini/i,
  'gpt-5': /gpt-5/i,
  'o1': /^o1/i,
  'o3': /^o3/i,
  'o4': /^o4/i,
  'gemini-2': /gemini.*2/i,
  'gemini-3': /gemini.*3/i,
  'qwen': /qwen/i,
  'deepseek': /deepseek/i,
  'claude-4': /claude.*4|claude-4/i,
  'grok': /grok/i,
  'mistral': /mistral/i,
  'llama': /llama/i,
  'kimi': /kimi/i,
  'glm': /glm/i,
  'minimax': /minimax/i,
}

export function getModelFamily(modelId: string): string {
  const lower = modelId.toLowerCase()
  for (const [family, pattern] of Object.entries(MODEL_FAMILIES)) {
    if (pattern.test(lower)) return family
  }
  const first = lower.split(/[/:-]/)[0]
  return first || 'unknown'
}

export function isReasoningModel(modelId: string): boolean {
  const lower = modelId.toLowerCase()
  return REASONING_MODEL_PATTERNS.some((p) => p.test(lower)) || lower.includes('thinking') || lower.includes('qwq')
}

export function isSmallModel(modelId: string): boolean {
  const lower = modelId.toLowerCase()
  return SMALL_MODEL_PATTERNS.some((p) => p.test(lower))
}

export function getDefaultMaxTokens(modelId: string): number {
  const lower = modelId.toLowerCase()
  if (lower.includes('claude') && (lower.includes('sonnet') || lower.includes('opus'))) return 8192
  if (lower.includes('claude') && lower.includes('haiku')) return 4096
  if (lower.includes('gpt-4o-mini')) return 16384
  if (lower.includes('gpt-4o')) return 4096
  if (lower.includes('gpt-5')) return 8192
  if (lower.includes('o1') || lower.includes('o3') || lower.includes('o4')) return 65536
  if (lower.includes('gemini-3')) return 8192
  if (lower.includes('gemini')) return 4096
  if (lower.includes('qwen3.6-max')) return 8192
  if (lower.includes('qwen')) return 8192
  if (lower.includes('deepseek')) return 8192
  if (lower.includes('llama')) return 4096
  if (lower.includes('mistral')) return 4096
  return 4096
}

export interface ProviderRequest {
  model: string
  messages: any[]
  system?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  stop?: string[]
  stream?: boolean
  tools?: any[]
  toolChoice?: any
  thinking?: { type: string; budgetTokens?: number }
  metadata?: Record<string, any>
}

export function buildProviderRequest(base: ProviderRequest, context: TransformContext): ProviderRequest {
  const req: ProviderRequest = { ...base }

  switch (context.provider) {
    case 'anthropic': {
      req.maxTokens = req.maxTokens ?? 8192
      if (context.hasThinking && req.thinking) {
        req.maxTokens = Math.max(req.maxTokens, (req.thinking.budgetTokens ?? 16000) + 1)
      }
      break
    }

    case 'openai':
    case 'azure':
    case 'litellm': {
      req.maxTokens = req.maxTokens ?? 4096
      if (req.thinking && context.variant === 'thinking') {
        const effortMap: Record<string, string> = { low: 'low', medium: 'medium', high: 'high' }
        const effort = context.model.includes('o3') || context.model.includes('o4') ? 'medium' : 'high'
        ;(req as any).reasoning_effort = effortMap[effort] ?? 'medium'
      }
      break
    }

    case 'google': {
      req.maxTokens = req.maxTokens ?? 4096
      if (context.hasThinking && req.thinking) {
        ;(req as any).thinkingConfig = {
          includeThoughts: true,
          thinkingBudget: req.thinking.budgetTokens ?? 16000,
        }
      }
      if (context.variant === 'thinking') {
        ;(req as any).thinkingConfig = {
          ...(req as any).thinkingConfig,
          includeThoughts: true,
          thinkingLevel: 'high',
        }
      }
      delete req.thinking
      break
    }

    case 'opencode': {
      req.maxTokens = req.maxTokens ?? 8192
      if (context.hasThinking && req.thinking) {
        ;(req as any).enable_thinking = true
        req.maxTokens = Math.max(req.maxTokens, (req.thinking.budgetTokens ?? 8192) + 1)
      }
      break
    }

    case 'bedrock': {
      if (context.hasThinking && req.thinking) {
        ;(req as any).reasoningConfig = {
          type: 'enabled',
          budgetTokens: req.thinking.budgetTokens ?? 16000,
        }
      }
      delete req.thinking
      break
    }

    case 'xai': {
      if (context.variant === 'thinking' && req.thinking) {
        ;(req as any).reasoningEffort = 'high'
      }
      break
    }

    case 'opencode-zen': {
      req.maxTokens = req.maxTokens ?? 4096
      if (context.variant === 'thinking' && req.thinking) {
        ;(req as any).reasoning_effort = 'high'
        req.maxTokens = Math.max(req.maxTokens, (req.thinking.budgetTokens ?? 16000) + 1)
      }
      break
    }
  }

  if (context.provider !== 'opencode' && req.metadata) {
    if (context.provider === 'openrouter') {
      ;(req as any).transforms = [req.metadata]
    }
    delete req.metadata
  }

  if (req.system && (context.provider === 'openai' || context.provider === 'azure' || context.provider === 'litellm')) {
    req.messages = [{ role: 'system', content: req.system }, ...req.messages]
    delete req.system
  }

  return req
}

export * as ProviderTransforms from './ProviderTransforms'
