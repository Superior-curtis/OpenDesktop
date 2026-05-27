// ============================================================================
// Cost Tracker (based on Claude Code's real-time token tracking)
// Tracks tokens per-message accumulation, not post-settlement
// ============================================================================

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  thinkingTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  cost: number
}

export const EMPTY_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  thinkingTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  cost: 0,
}

export interface ModelPricing {
  input: number       // per 1M tokens
  output: number      // per 1M tokens
  cacheRead: number   // per 1M tokens
  cacheCreate: number // per 1M tokens
  thinking?: number   // per 1M tokens (if separate)
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-20250514': { input: 3, output: 15, cacheRead: 0.30, cacheCreate: 3.75 },
  'claude-3.5-sonnet': { input: 3, output: 15, cacheRead: 0.30, cacheCreate: 3.75 },
  'claude-3-opus': { input: 15, output: 75, cacheRead: 1.50, cacheCreate: 18.75 },
  'claude-3-haiku': { input: 0.25, output: 1.25, cacheRead: 0.03, cacheCreate: 0.30 },
  'qwen3.6-plus': { input: 0.50, output: 2.0, cacheRead: 0.05, cacheCreate: 0.50 },
  'default': { input: 3, output: 15, cacheRead: 0.30, cacheCreate: 3.75 },
}

export function getPricing(model: string): ModelPricing {
  return MODEL_PRICING[model] ?? MODEL_PRICING['default']
}

export function calculateCost(
  usage: Partial<TokenUsage>,
  model: string,
): number {
  const pricing = getPricing(model)

  const inputCost = (usage.inputTokens ?? 0) / 1_000_000 * pricing.input
  const outputCost = (usage.outputTokens ?? 0) / 1_000_000 * pricing.output
  const cacheReadCost = (usage.cacheReadTokens ?? 0) / 1_000_000 * pricing.cacheRead
  const cacheCreateCost = (usage.cacheCreationTokens ?? 0) / 1_000_000 * pricing.cacheCreate

  return inputCost + outputCost + cacheReadCost + cacheCreateCost
}

export function formatCost(cost: number): string {
  if (cost < 0.001) return '$0.00'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 1) return `$${cost.toFixed(3)}`
  if (cost < 100) return `$${cost.toFixed(2)}`
  return `$${cost.toFixed(0)}`
}

// ============================================================================
// Turn-Level Cost Tracker
// ============================================================================

export interface TurnCost {
  turnNumber: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  thinkingTokens: number
  cost: number
  model: string
  timestamp: number
  querySource: string
}

// ============================================================================
// Session Cost Tracker
// ============================================================================

export class CostTracker {
  private turns: TurnCost[] = []
  private currentTurnUsage: TokenUsage = { ...EMPTY_USAGE }
  private sessionTotal: TokenUsage = { ...EMPTY_USAGE }
  private currentModel: string = 'default'
  private listeners: Set<(usage: TokenUsage) => void> = new Set()

  constructor(model?: string) {
    if (model) this.currentModel = model
  }

  on(listener: (usage: TokenUsage) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try { listener({ ...this.sessionTotal }) } catch { /* ignore */ }
    }
  }

  setModel(model: string): void {
    this.currentModel = model
  }

  getModel(): string {
    return this.currentModel
  }

  // Real-time per-message token accumulation
  trackChunk(chunkType: 'input' | 'output' | 'thinking' | 'cache_read' | 'cache_creation', tokens: number): void {
    switch (chunkType) {
      case 'input':
        this.currentTurnUsage.inputTokens += tokens
        this.sessionTotal.inputTokens += tokens
        break
      case 'output':
        this.currentTurnUsage.outputTokens += tokens
        this.sessionTotal.outputTokens += tokens
        break
      case 'thinking':
        this.currentTurnUsage.thinkingTokens += tokens
        this.currentTurnUsage.outputTokens += tokens
        this.sessionTotal.thinkingTokens += tokens
        this.sessionTotal.outputTokens += tokens
        break
      case 'cache_read':
        this.currentTurnUsage.cacheReadTokens += tokens
        this.sessionTotal.cacheReadTokens += tokens
        break
      case 'cache_creation':
        this.currentTurnUsage.cacheCreationTokens += tokens
        this.sessionTotal.cacheCreationTokens += tokens
        break
    }

    this.currentTurnUsage.totalTokens = this.currentTurnUsage.inputTokens + this.currentTurnUsage.outputTokens
    this.sessionTotal.totalTokens = this.sessionTotal.inputTokens + this.sessionTotal.outputTokens
    this.currentTurnUsage.cost = calculateCost(this.currentTurnUsage, this.currentModel)
    this.sessionTotal.cost = calculateCost(this.sessionTotal, this.currentModel)
    this.emit()
  }

  // Start a new turn (called before each model request)
  startTurn(_turnNumber: number, _querySource: string = 'main'): void {
    // Finalize previous turn if not already done
    if (this.currentTurnUsage.inputTokens > 0 || this.currentTurnUsage.outputTokens > 0) {
      this.finalizeTurn()
    }

    this.currentTurnUsage = { ...EMPTY_USAGE }
  }

  // Finalize current turn and record it
  finalizeTurn(querySource: string = 'main'): TurnCost {
    const turn: TurnCost = {
      turnNumber: this.turns.length + 1,
      inputTokens: this.currentTurnUsage.inputTokens,
      outputTokens: this.currentTurnUsage.outputTokens,
      cacheReadTokens: this.currentTurnUsage.cacheReadTokens,
      cacheCreationTokens: this.currentTurnUsage.cacheCreationTokens,
      thinkingTokens: this.currentTurnUsage.thinkingTokens,
      cost: this.currentTurnUsage.cost,
      model: this.currentModel,
      timestamp: Date.now(),
      querySource,
    }

    this.turns.push(turn)

    this.currentTurnUsage = { ...EMPTY_USAGE }

    return turn
  }

  // Get current turn usage (real-time)
  getCurrentUsage(): TokenUsage {
    return { ...this.currentTurnUsage }
  }

  // Get session totals
  getSessionUsage(): TokenUsage {
    return { ...this.sessionTotal }
  }

  // Get all turns
  getTurns(): TurnCost[] {
    return [...this.turns]
  }

  // Get last N turns
  getLastTurns(n: number): TurnCost[] {
    return this.turns.slice(-n)
  }

  // Get turn history for display
  getTurnHistory(): string[] {
    return this.turns.map((t, i) =>
      `Turn ${i + 1}: ${t.inputTokens} in → ${t.outputTokens} out (${t.thinkingTokens} thinking) · ${formatCost(t.cost)} · ${t.model}`,
    )
  }

  // Reset everything
  reset(): void {
    this.turns = []
    this.currentTurnUsage = { ...EMPTY_USAGE }
    this.sessionTotal = { ...EMPTY_USAGE }
    this.emit()
  }

  // Get cost summary
  getSummary(): string {
    const s = this.sessionTotal
    const lines = [
      `Total: ${s.totalTokens.toLocaleString()} tokens`,
      `  Input: ${s.inputTokens.toLocaleString()}`,
      `  Output: ${s.outputTokens.toLocaleString()}`,
    ]
    if (s.thinkingTokens > 0) lines.push(`  Thinking: ${s.thinkingTokens.toLocaleString()}`)
    if (s.cacheReadTokens > 0) lines.push(`  Cache read: ${s.cacheReadTokens.toLocaleString()}`)
    if (s.cacheCreationTokens > 0) lines.push(`  Cache create: ${s.cacheCreationTokens.toLocaleString()}`)
    lines.push(`  Cost: ${formatCost(s.cost)}`)
    lines.push(`  Turns: ${this.turns.length}`)
    return lines.join('\n')
  }
}
