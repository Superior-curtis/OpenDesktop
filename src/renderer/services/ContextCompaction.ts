import { Message } from '../types'
import { ApiClient } from './ApiClient'
import { useChatStore } from '../store/chatStore'

// ============================================================================
// Constants (from Claude Code source)
// ============================================================================

// Reserve this many tokens for output during compaction
// Based on p99.99 of compact summary output being 17,387 tokens.
export const MAX_OUTPUT_TOKENS_FOR_SUMMARY = 20_000

// Buffer tokens before context window limit
export const AUTOCOMPACT_BUFFER_TOKENS = 13_000
export const WARNING_THRESHOLD_BUFFER_TOKENS = 20_000
export const ERROR_THRESHOLD_BUFFER_TOKENS = 20_000
export const MANUAL_COMPACT_BUFFER_TOKENS = 3_000

// Stop trying autocompact after this many consecutive failures.
// BQ 2026-03-10: 1,279 sessions had 50+ consecutive failures (up to 3,272)
// in a single session, wasting ~250K API calls/day globally.
export const MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3

// Post-compaction cleanup budgets
export const POST_COMPACT_MAX_FILES_TO_RESTORE = 5
export const POST_COMPACT_TOKEN_BUDGET = 50_000
export const POST_COMPACT_MAX_TOKENS_PER_FILE = 5_000
export const POST_COMPACT_MAX_TOKENS_PER_SKILL = 5_000
export const POST_COMPACT_SKILLS_TOKEN_BUDGET = 25_000

// ============================================================================
// Token Estimation
// ============================================================================

export function estimateTokens(text: string): number {
  // Rough estimation: 4 chars ≈ 1 token
  return Math.ceil(text.length / 4)
}

export function estimateMessageTokens(message: Message): number {
  return estimateTokens(message.content)
}

export function estimateMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
}

// ============================================================================
// Context Window Calculation
// ============================================================================

export interface ModelContextWindow {
  contextWindow: number
  maxOutputTokens: number
}

export const MODEL_CONTEXT_WINDOWS: Record<string, ModelContextWindow> = {
  'sonnet': { contextWindow: 200_000, maxOutputTokens: 8_192 },
  'opus': { contextWindow: 200_000, maxOutputTokens: 4_096 },
  'haiku': { contextWindow: 200_000, maxOutputTokens: 4_096 },
  'qwen3.6-plus': { contextWindow: 128_000, maxOutputTokens: 8_192 },
  'opencode/deepseek-v4-flash-free': { contextWindow: 128_000, maxOutputTokens: 16_384 },
  'deepseek-v4-flash-free': { contextWindow: 128_000, maxOutputTokens: 16_384 },
  'default': { contextWindow: 128_000, maxOutputTokens: 8_192 },
}

export function getContextWindowForModel(model: string): number {
  const config = MODEL_CONTEXT_WINDOWS[model] || MODEL_CONTEXT_WINDOWS['default']
  return config.contextWindow
}

export function getMaxOutputTokensForModel(model: string): number {
  const config = MODEL_CONTEXT_WINDOWS[model] || MODEL_CONTEXT_WINDOWS['default']
  return config.maxOutputTokens
}

// Returns the context window size minus the max output tokens for the model
export function getEffectiveContextWindowSize(model: string): number {
  const reservedTokensForSummary = Math.min(
    getMaxOutputTokensForModel(model),
    MAX_OUTPUT_TOKENS_FOR_SUMMARY,
  )
  const contextWindow = getContextWindowForModel(model)
  return contextWindow - reservedTokensForSummary
}

// ============================================================================
// Token Warning State
// ============================================================================

export interface TokenWarningState {
  percentLeft: number
  isAboveWarningThreshold: boolean
  isAboveErrorThreshold: boolean
  isAboveAutoCompactThreshold: boolean
  isAtBlockingLimit: boolean
}

export function calculateTokenWarningState(
  tokenUsage: number,
  model: string,
  isAutoCompactEnabled: boolean = true,
): TokenWarningState {
  const autoCompactThreshold = getAutoCompactThreshold(model)
  const threshold = isAutoCompactEnabled
    ? autoCompactThreshold
    : getEffectiveContextWindowSize(model)

  const percentLeft = Math.max(
    0,
    Math.round(((threshold - tokenUsage) / threshold) * 100),
  )

  const warningThreshold = threshold - WARNING_THRESHOLD_BUFFER_TOKENS
  const errorThreshold = threshold - ERROR_THRESHOLD_BUFFER_TOKENS

  const isAboveWarningThreshold = tokenUsage >= warningThreshold
  const isAboveErrorThreshold = tokenUsage >= errorThreshold

  const isAboveAutoCompactThreshold =
    isAutoCompactEnabled && tokenUsage >= autoCompactThreshold

  const actualContextWindow = getEffectiveContextWindowSize(model)
  const blockingLimit = actualContextWindow - MANUAL_COMPACT_BUFFER_TOKENS

  const isAtBlockingLimit = tokenUsage >= blockingLimit

  return {
    percentLeft,
    isAboveWarningThreshold,
    isAboveErrorThreshold,
    isAboveAutoCompactThreshold,
    isAtBlockingLimit,
  }
}

// ============================================================================
// Auto Compact Threshold
// ============================================================================

export function getAutoCompactThreshold(model: string): number {
  const effectiveContextWindow = getEffectiveContextWindowSize(model)
  return effectiveContextWindow - AUTOCOMPACT_BUFFER_TOKENS
}

export function shouldAutoCompact(
  messages: Message[],
  model: string,
  isAutoCompactEnabled: boolean = true,
): boolean {
  if (!isAutoCompactEnabled) return false

  const tokenCount = estimateMessagesTokens(messages)
  const { isAboveAutoCompactThreshold } = calculateTokenWarningState(
    tokenCount,
    model,
    isAutoCompactEnabled,
  )

  return isAboveAutoCompactThreshold
}

// ============================================================================
// 5-Layer Context Management Pipeline
// ============================================================================

export interface ContextPipelineResult {
  messages: Message[]
  tokensFreed: number
  layersApplied: string[]
}

export async function runContextPipeline(
  messages: Message[],
  model: string,
  options: {
    isAutoCompactEnabled?: boolean
    onCompaction?: (result: CompactionResult) => void
  } = {},
): Promise<ContextPipelineResult> {
  const { isAutoCompactEnabled = true } = options
  const layersApplied: string[] = []
  let result = [...messages]
  let tokensFreed = 0

  // Layer 1: Tool Result Budget
  const budgetResult = applyToolResultBudget(result)
  if (budgetResult.tokensFreed > 0) {
    tokensFreed += budgetResult.tokensFreed
    layersApplied.push('tool_result_budget')
  }
  result = budgetResult.messages

  // Layer 2: History Snip
  const snipResult = snipCompactIfNeeded(result)
  if (snipResult.tokensFreed > 0) {
    tokensFreed += snipResult.tokensFreed
    layersApplied.push('history_snip')
  }
  result = snipResult.messages

  // Layer 3: Microcompact
  const microResult = microcompact(result)
  if (microResult.tokensFreed > 0) {
    tokensFreed += microResult.tokensFreed
    layersApplied.push('microcompact')
  }
  result = microResult.messages

  // Layer 4: Context Collapse
  const collapseResult = applyCollapsesIfNeeded(result)
  if (collapseResult.tokensFreed > 0) {
    tokensFreed += collapseResult.tokensFreed
    layersApplied.push('context_collapse')
  }
  result = collapseResult.messages

  // Layer 5: Auto Compact — real API summarization
  if (shouldAutoCompact(result, model, isAutoCompactEnabled)) {
    try {
      const compactionResult = await compactConversation(result, model)
      if (compactionResult.summaryMessages.length > 0) {
        const preTokens = estimateMessagesTokens(result)
        tokensFreed += preTokens - compactionResult.postCompactTokenCount
        layersApplied.push('auto_compact (api)')

        const keepCount = Math.min(2, result.length)
        const keep = result.slice(-keepCount)
        result = [...compactionResult.summaryMessages, ...keep]
      }
    } catch (error) {
      console.warn('Layer 5 auto-compact failed:', error)
      layersApplied.push('auto_compact (failed)')
    }
  }

  return {
    messages: result,
    tokensFreed,
    layersApplied,
  }
}

// ============================================================================
// Layer 1: Tool Result Budget
// ============================================================================

export interface ToolResultBudgetResult {
  messages: Message[]
  tokensFreed: number
}

export const MAX_TOOL_RESULT_CHARS = 10_000

export function applyToolResultBudget(messages: Message[]): ToolResultBudgetResult {
  let tokensFreed = 0
  const result = messages.map((msg) => {
    if (msg.role === 'user' && msg.content.length > MAX_TOOL_RESULT_CHARS) {
      const truncated = msg.content.slice(0, MAX_TOOL_RESULT_CHARS) + '\n\n[Tool result truncated...]'
      tokensFreed += estimateTokens(msg.content) - estimateTokens(truncated)
      return {
        ...msg,
        content: truncated,
      }
    }
    return msg
  })

  return { messages: result, tokensFreed }
}

// ============================================================================
// Layer 2: History Snip
// ============================================================================

export interface SnipCompactResult {
  messages: Message[]
  tokensFreed: number
  boundaryMessage?: Message
}

export const MAX_MESSAGES_BEFORE_SNIP = 50

export function snipCompactIfNeeded(messages: Message[]): SnipCompactResult {
  if (messages.length <= MAX_MESSAGES_BEFORE_SNIP) {
    return { messages, tokensFreed: 0 }
  }

  const tokensFreed = estimateMessagesTokens(messages.slice(0, -MAX_MESSAGES_BEFORE_SNIP))
  const keep = messages.slice(-MAX_MESSAGES_BEFORE_SNIP)

  const boundaryMessage: Message = {
    id: crypto.randomUUID(),
    role: 'system',
    content: `[${messages.length - MAX_MESSAGES_BEFORE_SNIP} older messages snipped for context management]`,
    timestamp: Date.now(),
  }

  return {
    messages: [boundaryMessage, ...keep],
    tokensFreed,
    boundaryMessage,
  }
}

// ============================================================================
// Layer 3: Microcompact
// ============================================================================

export interface MicrocompactResult {
  messages: Message[]
  tokensFreed: number
}

export function microcompact(messages: Message[]): MicrocompactResult {
  let tokensFreed = 0
  const result: Message[] = []
  let i = 0

  while (i < messages.length) {
    // Combine short consecutive assistant/user exchanges
    if (
      i < messages.length - 1 &&
      messages[i].role === 'assistant' &&
      messages[i + 1].role === 'user' &&
      messages[i].content.length < 500 &&
      messages[i + 1].content.length < 500
    ) {
      const originalTokens = estimateMessageTokens(messages[i]) + estimateMessageTokens(messages[i + 1])
      const combined: Message = {
        id: messages[i].id,
        role: 'assistant',
        content: messages[i].content + '\n\n[User response: ' + messages[i + 1].content.slice(0, 200) + '...]',
        timestamp: messages[i].timestamp,
      }
      tokensFreed += originalTokens - estimateMessageTokens(combined)
      result.push(combined)
      i += 2
    } else {
      result.push(messages[i])
      i++
    }
  }

  return { messages: result, tokensFreed }
}

// ============================================================================
// Layer 4: Context Collapse
// ============================================================================

export interface ContextCollapseResult {
  messages: Message[]
  tokensFreed: number
}

export function applyCollapsesIfNeeded(messages: Message[]): ContextCollapseResult {
  // Placeholder for context collapse (granular archiving)
  // In Claude Code, this is feature-gated and uses a commit log
  return { messages, tokensFreed: 0 }
}

// ============================================================================
// Layer 5: Auto Compact
// ============================================================================

export interface CompactionResult {
  summaryMessages: Message[]
  attachments: Message[]
  hookResults: Message[]
  preCompactTokenCount: number
  postCompactTokenCount: number
  truePostCompactTokenCount: number
  compactionUsage?: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
}

export interface AutoCompactTrackingState {
  compacted: boolean
  turnCounter: number
  turnId: string
  consecutiveFailures?: number
}

export async function autoCompactIfNeeded(
  messages: Message[],
  model: string,
  isAutoCompactEnabled: boolean = true,
  tracking?: AutoCompactTrackingState,
): Promise<{
  wasCompacted: boolean
  compactionResult?: CompactionResult
  consecutiveFailures?: number
}> {
  if (!isAutoCompactEnabled) {
    return { wasCompacted: false }
  }

  // Circuit breaker: stop retrying after N consecutive failures.
  if (
    tracking?.consecutiveFailures !== undefined &&
    tracking.consecutiveFailures >= MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES
  ) {
    return { wasCompacted: false }
  }

  const shouldCompact = shouldAutoCompact(messages, model, isAutoCompactEnabled)

  if (!shouldCompact) {
    return { wasCompacted: false }
  }

  try {
    const compactionResult = await compactConversation(messages, model)

    return {
      wasCompacted: true,
      compactionResult,
      consecutiveFailures: 0,
    }
  } catch (error) {
    const prevFailures = tracking?.consecutiveFailures ?? 0
    const nextFailures = prevFailures + 1

    if (nextFailures >= MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES) {
      console.warn(
        `Auto-compact: circuit breaker tripped after ${nextFailures} consecutive failures`,
      )
    }

    return { wasCompacted: false, consecutiveFailures: nextFailures }
  }
}

// ============================================================================
// Conversation Compaction
// ============================================================================

export const COMPACT_PROMPT = `CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.

- Do NOT use Read, Bash, Grep, Glob, Edit, Write, or ANY other tool.
- You already have all the context you need in the conversation above.
- Tool calls will be REJECTED and will waste your only turn — you will fail the task.
- Your entire response must be plain text: an <analysis> block followed by a <summary> block.

Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions.
This summary should be thorough in capturing technical details, code patterns, and architectural decisions that would be essential for continuing development work without losing context.

Before providing your final summary, wrap your analysis in <analysis> tags to organize your thoughts and ensure you've covered all necessary points. In your analysis process:

1. Chronologically analyze each message and section of the conversation. For each section thoroughly identify:
   - The user's explicit requests and intents
   - Your approach to addressing the user's requests
   - Key decisions, technical concepts and code patterns
   - Specific details like:
     - file names
     - full code snippets
     - function signatures
     - file edits
   - Errors that you ran into and how you fixed them
   - Pay special attention to specific user feedback that you received, especially if the user told you to do something differently.
2. Double-check for technical accuracy and completeness, addressing each required element thoroughly.

Your summary should include the following sections:

1. Primary Request and Intent: Capture all of the user's explicit requests and intents in detail
2. Key Technical Concepts: List all important technical concepts, technologies, and frameworks discussed.
3. Files and Code Sections: Enumerate specific files and code sections examined, modified, or created. Pay special attention to the most recent messages and include full code snippets where applicable and include a summary of why this file read or edit is important.
4. Errors and fixes: List all errors that you ran into, and how you fixed them. Pay special attention to specific user feedback that you received, especially if the user told you to do something differently.
5. Problem Solving: Document problems solved and any ongoing troubleshooting efforts.
6. All user messages: List ALL user messages that are not tool results. These are critical for understanding the users' feedback and changing intent.
7. Pending Tasks: Outline any pending tasks that you have explicitly been asked to work on.
8. Current Work: Describe in detail precisely what was being worked on immediately before this summary request, paying special attention to the most recent messages from both user and assistant. Include file names and code snippets where applicable.
9. Optional Next Step: List the next step that you will take that is related to the most recent work you were doing. IMPORTANT: ensure that this step is DIRECTLY in line with the user's most recent explicit requests, and the task you were working on immediately before this summary request. If your last task was concluded, then only list next steps if they are explicitly in line with the users request. Do not start on tangential requests or really old requests that were already completed without confirming with the user first.
                       If there is a next step, include direct quotes from the most recent conversation showing exactly what task you were working on and where you left off. This should be verbatim to ensure there's no drift in task interpretation.

Here's an example of how your output should be structured:

<example>
<analysis>
[Your thought process, ensuring all points are covered thoroughly and accurately]
</analysis>

<summary>
1. Primary Request and Intent:
   [Detailed description]

2. Key Technical Concepts:
   - [Concept 1]
   - [Concept 2]
   - [...]

3. Files and Code Sections:
   - [File Name 1]
      - [Summary of why this file is important]
      - [Summary of the changes made to this file, if any]
      - [Important Code Snippet]
   - [File Name 2]
      - [Important Code Snippet]
   - [...]

4. Errors and fixes:
    - [Detailed description of error 1]:
      - [How you fixed the error]
      - [User feedback on the error if any]
    - [...]

5. Problem Solving:
   [Description of solved problems and ongoing troubleshooting]

6. All user messages:
    - [Detailed non tool use user message]
    - [...]

7. Pending Tasks:
   - [Task 1]
   - [Task 2]
   - [...]

8. Current Work:
   [Precise description of current work]

9. Optional Next Step:
   [Optional Next step to take]

</summary>
</example>

Please provide your summary based on the conversation so far, following this structure and ensuring precision and thoroughness in your response.

REMINDER: Do NOT call any tools. Respond with plain text only — an <analysis> block followed by a <summary> block. Tool calls will be rejected and you will fail the task.`

export function formatCompactSummary(summary: string): string {
  let formattedSummary = summary

  // Strip analysis section — it's a drafting scratchpad
  formattedSummary = formattedSummary.replace(
    /<analysis>[\s\S]*?<\/analysis>/,
    '',
  )

  // Extract and format summary section
  const summaryMatch = formattedSummary.match(/<summary>([\s\S]*?)<\/summary>/)
  if (summaryMatch) {
    const content = summaryMatch[1] || ''
    formattedSummary = formattedSummary.replace(
      /<summary>[\s\S]*?<\/summary>/,
      `Summary:\n${content.trim()}`,
    )
  }

  // Clean up extra whitespace
  formattedSummary = formattedSummary.replace(/\n\n+/g, '\n\n')

  return formattedSummary.trim()
}

export async function compactConversation(
  messages: Message[],
  _model: string,
): Promise<CompactionResult> {
  const preCompactTokenCount = estimateMessagesTokens(messages)

  try {
    const store = useChatStore.getState()
    const provider = store.providers.find(p => p.id === store.activeProviderId)
    if (!provider) throw new Error('No active provider available')

    const client = new ApiClient(provider)

    const promptMessages: Message[] = [
      ...messages.slice(-30), // last 30 messages for context
      { id: crypto.randomUUID(), role: 'user', content: COMPACT_PROMPT, timestamp: Date.now() },
    ]

    const stream = await client.chat(promptMessages, true, false, 0)
    let responseContent = ''

    for await (const chunk of stream) {
      const text = typeof chunk === 'string' ? chunk : (chunk as any).content || ''
      if (text) responseContent += text
    }

    const formattedSummary = formatCompactSummary(responseContent)

    const summaryMessage: Message = {
      id: crypto.randomUUID(),
      role: 'system' as const,
      content: `[Context Compacted]\n\n${formattedSummary}`,
      timestamp: Date.now(),
    }

    const postCompactTokenCount = estimateMessageTokens(summaryMessage)

    return {
      summaryMessages: [summaryMessage],
      attachments: [],
      hookResults: [],
      preCompactTokenCount,
      postCompactTokenCount,
      truePostCompactTokenCount: postCompactTokenCount,
    }
  } catch (error) {
    console.warn('Context compaction failed:', error)
    return {
      summaryMessages: [],
      attachments: [],
      hookResults: [],
      preCompactTokenCount,
      postCompactTokenCount: preCompactTokenCount,
      truePostCompactTokenCount: preCompactTokenCount,
    }
  }
}

// ============================================================================
// Post-Compact Cleanup
// ============================================================================

export async function runPostCompactCleanup(querySource?: string): Promise<Message[]> {
  const cleanupMessages: Message[] = []

  try {
    const pluginManager = (await import('./PluginSystem')).getPluginManager()
    await pluginManager.emit('post_compact_cleanup', { querySource })
  } catch { /* plugin manager not available */ }

  return cleanupMessages
}
