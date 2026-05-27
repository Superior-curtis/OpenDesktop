import { estimateTokens, estimateMessagesTokens } from './ContextCompaction'

// ============================================================================
// MicroCompact
// ============================================================================

export interface MicroCompactResult {
  messages: any[]
  tokensFreed: number
  summary: string
}

const SYSTEM_BOUNDARY_SUFFIX = 'older messages snipped for context management]'

function isSystemBoundary(msg: any): boolean {
  return (
    msg.role === 'system' &&
    typeof msg.content === 'string' &&
    msg.content.endsWith(SYSTEM_BOUNDARY_SUFFIX)
  )
}

function isProgressMessage(msg: any): boolean {
  return msg.role === 'system' && msg.content === '[progress]'
}

function hasThinkingContent(msg: any): boolean {
  return msg.isThinking === true || (typeof msg.content === 'string' && msg.content.includes('[thinking]'))
}

export function microCompact(messages: any[]): MicroCompactResult {
  let tokensFreed = 0
  const keepTurns = 20
  const result: any[] = []

  // Track boundary messages encountered
  const boundaries: number[] = []
  for (let i = 0; i < messages.length; i++) {
    if (isSystemBoundary(messages[i])) {
      boundaries.push(i)
    }
  }

  // Remove boundary messages older than keepTurns turns from the end
  const systemRemovals: Set<number> = new Set()
  if (boundaries.length > 0) {
    const lastBoundary = boundaries[boundaries.length - 1]
    const remainingAfterBoundary = messages.length - lastBoundary - 1
    if (remainingAfterBoundary > keepTurns) {
      for (const idx of boundaries) {
        const turnsAfter = messages.length - idx - 1
        if (turnsAfter > keepTurns) {
          systemRemovals.add(idx)
          tokensFreed += estimateTokens(messages[idx]?.content ?? '')
        }
      }
    }
  }

  // Collapse consecutive assistant+tool pairs: if a later assistant+tool pair
  // supersedes an earlier one, drop the earlier pair
  const collapsed: Set<number> = new Set()
  const toolCallIds = new Map<string, number>() // toolCallId -> index
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.toolCallId && toolCallIds.has(msg.toolCallId)) {
      const prevIdx = toolCallIds.get(msg.toolCallId)!
      collapsed.add(prevIdx)
      if (prevIdx > 0 && messages[prevIdx - 1]?.role === 'assistant') {
        collapsed.add(prevIdx - 1)
      }
      collapsed.add(i)
    }
    if (msg.toolCallId) {
      toolCallIds.set(msg.toolCallId, i)
    }
  }

  // Build result
  let strippedThinking = 0
  for (let i = 0; i < messages.length; i++) {
    if (systemRemovals.has(i) || collapsed.has(i)) continue

    const msg = messages[i]

    // Strip progress messages
    if (isProgressMessage(msg)) {
      tokensFreed += estimateTokens(msg.content ?? '')
      continue
    }

    // Strip thinking content from old assistant messages (keep only final output)
    if (msg.role === 'assistant' && hasThinkingContent(msg) && i < messages.length - 3) {
      const content = typeof msg.content === 'string' ? msg.content : ''
      const finalOutput = extractFinalOutput(content)
      if (finalOutput.length < content.length) {
        strippedThinking++
        const saved = estimateTokens(content) - estimateTokens(finalOutput)
        tokensFreed += saved
        result.push({ ...msg, content: finalOutput, isThinking: false })
        continue
      }
    }

    result.push(msg)
  }

  const summaryLines: string[] = []
  if (systemRemovals.size > 0) summaryLines.push(`removed ${systemRemovals.size} old boundary messages`)
  if (collapsed.size > 0) summaryLines.push(`collapsed ${collapsed.size} superseded messages`)
  if (strippedThinking > 0) summaryLines.push(`stripped thinking from ${strippedThinking} messages`)
  const summary = summaryLines.length > 0 ? summaryLines.join(', ') : 'no compaction needed'

  return { messages: result, tokensFreed, summary }
}

function extractFinalOutput(content: string): string {
  const thinkingEnd = Math.max(
    content.lastIndexOf('[thinking]'),
    content.lastIndexOf('</thinking>'),
  )
  if (thinkingEnd === -1) return content
  return content.slice(thinkingEnd + 1).trim()
}

// ============================================================================
// Auto Compact Config
// ============================================================================

export interface AutoCompactConfig {
  enabled: boolean
  maxConsecutiveFailures: number
  minTokensFreed: number
  warningThreshold: number
  reserveTokens: number
}

export const DEFAULT_AUTO_COMPACT_CONFIG: AutoCompactConfig = {
  enabled: true,
  maxConsecutiveFailures: 3,
  minTokensFreed: 2000,
  warningThreshold: 13000,
  reserveTokens: 20000,
}

export interface AutoCompactResult {
  triggered: boolean
  success: boolean
  tokensFreed: number
  failureCount: number
  reason?: string
}

// ============================================================================
// Auto Compact Manager
// ============================================================================

export interface CompactResult {
  messages: any[]
  tokensFreed: number
  layers: string[]
}

export class AutoCompactManager {
  private config: AutoCompactConfig
  private consecutiveFailures: number = 0
  private listeners: Set<(result: AutoCompactResult) => void> = new Set()

  constructor(config?: Partial<AutoCompactConfig>) {
    this.config = { ...DEFAULT_AUTO_COMPACT_CONFIG, ...config }
  }

  evaluate(messages: any[], contextWindow: number, usedTokens: number): AutoCompactResult {
    if (!this.config.enabled) {
      return { triggered: false, success: false, tokensFreed: 0, failureCount: this.consecutiveFailures, reason: 'disabled' }
    }

    if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return { triggered: false, success: false, tokensFreed: 0, failureCount: this.consecutiveFailures, reason: 'max consecutive failures exceeded' }
    }

    const availableTokens = contextWindow - usedTokens
    if (availableTokens > this.config.warningThreshold) {
      return { triggered: false, success: false, tokensFreed: 0, failureCount: this.consecutiveFailures, reason: 'under warning threshold' }
    }

    const estimatedFreed = this.estimateTokensToFree(messages)
    if (estimatedFreed < this.config.minTokensFreed) {
      return { triggered: false, success: false, tokensFreed: 0, failureCount: this.consecutiveFailures, reason: `estimated freed (${estimatedFreed}) < min (${this.config.minTokensFreed})` }
    }

    return { triggered: true, success: false, tokensFreed: estimatedFreed, failureCount: this.consecutiveFailures }
  }

  async compact(messages: any[], _contextWindow: number): Promise<CompactResult> {
    const layers: string[] = []

    // Layer 1: micro compact
    const microResult = microCompact(messages)
    let currentMessages = microResult.messages
    let tokensFreed = microResult.tokensFreed
    if (tokensFreed > 0) layers.push('microCompact')

    // Layer 2: summary collapse if not enough tokens freed
    if (tokensFreed < this.config.minTokensFreed) {
      const collapsed = await this.summaryCollapse(currentMessages)
      if (collapsed.tokensFreed > 0) {
        tokensFreed += collapsed.tokensFreed
        currentMessages = collapsed.messages
        layers.push('summaryCollapse')
      }
    }

    const result: AutoCompactResult = {
      triggered: true,
      success: tokensFreed > 0,
      tokensFreed,
      failureCount: this.consecutiveFailures,
    }

    if (!result.success) {
      this.consecutiveFailures++
    } else {
      this.consecutiveFailures = 0
    }

    this.notifyListeners(result)

    return { messages: currentMessages, tokensFreed, layers }
  }

  private async summaryCollapse(messages: any[]): Promise<{ messages: any[]; tokensFreed: number }> {
    return { messages, tokensFreed: 0 }
  }

  private estimateTokensToFree(messages: any[]): number {
    const totalTokens = estimateMessagesTokens(messages)
    return Math.floor(totalTokens * 0.15)
  }

  private notifyListeners(result: AutoCompactResult): void {
    for (const listener of this.listeners) {
      try { listener(result) } catch { }
    }
  }

  getConfig(): AutoCompactConfig {
    return { ...this.config }
  }

  updateConfig(config: Partial<AutoCompactConfig>): void {
    this.config = { ...this.config, ...config }
  }

  resetFailureCount(): void {
    this.consecutiveFailures = 0
  }

  onChange(callback: (result: AutoCompactResult) => void): () => void {
    this.listeners.add(callback)
    return () => { this.listeners.delete(callback) }
  }
}

// ============================================================================
// Time-Based Compactor
// ============================================================================

export interface TimeBasedCompactConfig {
  enabled: boolean
  maxAgeMs: number
  intervalMs: number
  compactOnIdle: boolean
  idleThresholdMs: number
}

export const DEFAULT_TIME_BASED_CONFIG: TimeBasedCompactConfig = {
  enabled: true,
  maxAgeMs: 300_000,
  intervalMs: 60_000,
  compactOnIdle: true,
  idleThresholdMs: 120_000,
}

export class TimeBasedCompactor {
  private config: TimeBasedCompactConfig
  private timer: ReturnType<typeof setInterval> | null = null
  private lastActivity: number = Date.now()

  constructor(config?: Partial<TimeBasedCompactConfig>) {
    this.config = { ...DEFAULT_TIME_BASED_CONFIG, ...config }
  }

  start(messages: () => any[], onCompact: (result: { messages: any[]; tokensFreed: number }) => void): void {
    if (this.timer) return

    this.lastActivity = Date.now()
    this.timer = setInterval(() => {
      if (!this.config.enabled) return

      const now = Date.now()
      const isIdle = (now - this.lastActivity) >= this.config.idleThresholdMs

      if (this.config.compactOnIdle && !isIdle) return

      const msgs = messages()
      const compacted = this.compactOldEntries(msgs, now)
      if (compacted.tokensFreed > 0) {
        onCompact(compacted)
      }
    }, this.config.intervalMs)
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  isRunning(): boolean {
    return this.timer !== null
  }

  getConfig(): TimeBasedCompactConfig {
    return { ...this.config }
  }

  updateConfig(config: Partial<TimeBasedCompactConfig>): void {
    this.config = { ...this.config, ...config }
  }

  markActive(): void {
    this.lastActivity = Date.now()
  }

  private compactOldEntries(messages: any[], now: number): { messages: any[]; tokensFreed: number } {
    const cutoff = now - this.config.maxAgeMs
    const result: any[] = []
    let tokensFreed = 0
    let compactedCount = 0

    // Keep recent messages and the last system boundary, compact the rest
    let lastSystemIdx = -1
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'system') {
        lastSystemIdx = i
      }
    }

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const age = typeof msg.timestamp === 'number' ? now - msg.timestamp : 0
      const isTooOld = age > cutoff
      const isSystemBoundaryMessage = i === lastSystemIdx && isSystemBoundary(msg)
      const isRecent = i >= messages.length - 10

      if (isTooOld && !isSystemBoundaryMessage && !isRecent) {
        tokensFreed += estimateTokens(msg.content ?? '')
        compactedCount++
      } else {
        result.push(msg)
      }
    }

    if (compactedCount > 0) {
      result.push({
        id: crypto.randomUUID(),
        role: 'system',
        content: `[${compactedCount} old messages compacted by time-based compactor]`,
        timestamp: Date.now(),
      })
    }

    return { messages: result, tokensFreed }
  }
}

// ============================================================================
// Compact with Fallback
// ============================================================================

export async function compactWithFallback(
  messages: any[],
  _contextWindow: number,
): Promise<CompactResult> {
  const layers: string[] = []

  // Try micro compact first (always safe, fast)
  const microResult = microCompact(messages)
  let currentMessages = microResult.messages
  let tokensFreed = microResult.tokensFreed
  if (tokensFreed > 0) layers.push('microCompact')

  // If not enough tokens freed, try summary collapse
  if (tokensFreed < 2000) {
    try {
      const collapsed = await summaryCollapse(currentMessages)
      if (collapsed.tokensFreed > 0) {
        tokensFreed += collapsed.tokensFreed
        currentMessages = collapsed.messages
        layers.push('summaryCollapse')
      }
    } catch {
      layers.push('summaryCollapse_failed')
    }
  }

  // If summary fails, try message dropping strategy
  if (tokensFreed < 2000) {
    try {
      const dropped = dropOldMessages(currentMessages)
      if (dropped.tokensFreed > 0) {
        tokensFreed += dropped.tokensFreed
        currentMessages = dropped.messages
        layers.push('messageDrop')
      }
    } catch {
      layers.push('messageDrop_failed')
    }
  }

  // Fall back gracefully if nothing worked
  if (tokensFreed === 0) {
    return { messages, tokensFreed: 0, layers }
  }

  return { messages: currentMessages, tokensFreed, layers }
}

async function summaryCollapse(messages: any[]): Promise<{ messages: any[]; tokensFreed: number }> {
  return { messages, tokensFreed: 0 }
}

function dropOldMessages(messages: any[]): { messages: any[]; tokensFreed: number } {
  const keep = 30
  if (messages.length <= keep) return { messages, tokensFreed: 0 }

  const dropped = messages.slice(0, messages.length - keep)
  const keepArr = messages.slice(-keep)
  const tokensFreed = dropped.reduce((sum, m) => sum + estimateTokens(m.content ?? ''), 0)

  keepArr.unshift({
    id: crypto.randomUUID(),
    role: 'system',
    content: `[${dropped.length} older messages dropped for context management]`,
    timestamp: Date.now(),
  })

  return { messages: keepArr, tokensFreed }
}

// ============================================================================
// Singletons
// ============================================================================

let autoCompactManagerInstance: AutoCompactManager | null = null
let timeBasedCompactorInstance: TimeBasedCompactor | null = null

export function getAutoCompactManager(): AutoCompactManager {
  if (!autoCompactManagerInstance) {
    autoCompactManagerInstance = new AutoCompactManager()
  }
  return autoCompactManagerInstance
}

export function getTimeBasedCompactor(): TimeBasedCompactor {
  if (!timeBasedCompactorInstance) {
    timeBasedCompactorInstance = new TimeBasedCompactor()
  }
  return timeBasedCompactorInstance
}
