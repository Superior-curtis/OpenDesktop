export type EventCategory = 'session' | 'query' | 'tool' | 'error' | 'permission' | 'settings' | 'performance' | 'ui' | 'user'
export type EventSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface AnalyticsEvent {
  name: string
  category: EventCategory
  severity: EventSeverity
  timestamp: number
  duration?: number
  properties?: Record<string, unknown>
  error?: { message: string; code?: string; stack?: string }
}

export type FlagTarget = 'all' | 'beta' | 'internal' | 'none'

export interface FeatureFlag {
  key: string
  description: string
  enabled: boolean
  target: FlagTarget
  rolloutPercentage: number
  source?: 'local' | 'remote'
}

export const BUILTIN_FEATURE_FLAGS: FeatureFlag[] = [
  { key: 'thinking-ui', description: 'Show thinking panel', enabled: true, target: 'all', rolloutPercentage: 100 },
  { key: 'advanced-settings', description: 'Advanced settings panel', enabled: true, target: 'all', rolloutPercentage: 100 },
  { key: 'plugin-system', description: 'Plugin system', enabled: false, target: 'beta', rolloutPercentage: 50 },
  { key: 'team-sessions', description: 'Team session sharing', enabled: false, target: 'internal', rolloutPercentage: 10 },
  { key: 'lsp-integration', description: 'LSP diagnostics', enabled: false, target: 'beta', rolloutPercentage: 30 },
  { key: 'voice-input', description: 'Voice input', enabled: false, target: 'beta', rolloutPercentage: 20 },
  { key: 'oauth-flow', description: 'OAuth authentication', enabled: true, target: 'all', rolloutPercentage: 100 },
  { key: 'experimental-models', description: 'Experimental model access', enabled: false, target: 'internal', rolloutPercentage: 5 },
]

export class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map()

  register(flag: FeatureFlag): void {
    this.flags.set(flag.key, { ...flag })
  }

  isEnabled(key: string, userId?: string): boolean {
    const flag = this.flags.get(key)
    if (!flag || !flag.enabled) return false
    if (flag.target === 'none') return false
    if (flag.rolloutPercentage >= 100) return true
    if (flag.rolloutPercentage <= 0) return false
    if (!userId) return flag.rolloutPercentage > 0
    return this.hashUserId(key, userId) < flag.rolloutPercentage
  }

  enable(key: string): void {
    const flag = this.flags.get(key)
    if (flag) {
      this.flags.set(key, { ...flag, enabled: true })
    }
  }

  disable(key: string): void {
    const flag = this.flags.get(key)
    if (flag) {
      this.flags.set(key, { ...flag, enabled: false })
    }
  }

  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key)
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values())
  }

  setRollout(key: string, percentage: number): void {
    const flag = this.flags.get(key)
    if (flag) {
      this.flags.set(key, { ...flag, rolloutPercentage: Math.max(0, Math.min(100, percentage)) })
    }
  }

  getEnabledFlags(): string[] {
    return Array.from(this.flags.values())
      .filter(f => f.enabled)
      .map(f => f.key)
  }

  toPromptString(): string {
    return Array.from(this.flags.values())
      .map(f => `${f.key}: ${f.enabled ? 'enabled' : 'disabled'} (target: ${f.target}, rollout: ${f.rolloutPercentage}%)`)
      .join('\n')
  }

  private hashUserId(key: string, userId: string): number {
    const str = `${key}:${userId}`
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }
    return Math.abs(hash) % 100
  }
}

export class AnalyticsBuffer {
  private buffer: AnalyticsEvent[] = []
  private maxSize: number
  private flushInterval: number
  private intervalId: ReturnType<typeof setInterval> | null = null
  onFlush: ((events: AnalyticsEvent[]) => void) | null = null

  constructor(maxSize: number = 100, flushInterval: number = 30000) {
    this.maxSize = maxSize
    this.flushInterval = flushInterval
    if (this.flushInterval > 0) {
      this.intervalId = setInterval(() => { this.flush() }, this.flushInterval)
    }
  }

  push(event: AnalyticsEvent): void {
    this.buffer.push(event)
    if (this.buffer.length >= this.maxSize) {
      this.flush()
    }
  }

  flush(): AnalyticsEvent[] {
    if (this.buffer.length === 0) return []
    const events = [...this.buffer]
    this.buffer = []
    if (this.onFlush) {
      this.onFlush(events)
    }
    return events
  }

  getSize(): number {
    return this.buffer.length
  }

  clear(): void {
    this.buffer = []
  }

  destroy(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.buffer = []
    this.onFlush = null
  }
}

export class EventLogger {
  private events: AnalyticsEvent[] = []
  private maxEvents: number

  constructor(maxEvents: number = 1000) {
    this.maxEvents = maxEvents
  }

  log(event: AnalyticsEvent): void {
    this.events.push(event)
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(this.events.length - this.maxEvents)
    }
  }

  getRecent(limit?: number): AnalyticsEvent[] {
    const count = limit ?? this.events.length
    return this.events.slice(-count)
  }

  getByCategory(category: EventCategory, limit?: number): AnalyticsEvent[] {
    const filtered = this.events.filter(e => e.category === category)
    const count = limit ?? filtered.length
    return filtered.slice(-count)
  }

  getErrors(limit?: number): AnalyticsEvent[] {
    const errors = this.events.filter(e => e.category === 'error' || e.severity === 'error' || e.severity === 'critical')
    const count = limit ?? errors.length
    return errors.slice(-count)
  }

  export(): AnalyticsEvent[] {
    return [...this.events]
  }

  clear(): void {
    this.events = []
  }

  getStats(): { total: number; byCategory: Record<EventCategory, number>; errors: number; timeRange: [number, number] | null } {
    const byCategory = {
      'session': 0,
      'query': 0,
      'tool': 0,
      'error': 0,
      'permission': 0,
      'settings': 0,
      'performance': 0,
      'ui': 0,
      'user': 0,
    }
    let errors = 0
    let minTime: number | null = null
    let maxTime: number | null = null

    for (const event of this.events) {
      byCategory[event.category]++
      if (event.category === 'error' || event.severity === 'error' || event.severity === 'critical') {
        errors++
      }
      if (minTime === null || event.timestamp < minTime) minTime = event.timestamp
      if (maxTime === null || event.timestamp > maxTime) maxTime = event.timestamp
    }

    return {
      total: this.events.length,
      byCategory,
      errors,
      timeRange: minTime !== null && maxTime !== null ? [minTime, maxTime] : null,
    }
  }

  toPromptString(): string {
    const recent = this.getRecent(20)
    if (recent.length === 0) return 'No events recorded.'

    const lines: string[] = ['Recent events (newest first):']
    for (let i = recent.length - 1; i >= 0; i--) {
      const e = recent[i]
      const time = new Date(e.timestamp).toISOString()
      const dur = e.duration !== undefined ? ` [${e.duration}ms]` : ''
      const errorInfo = e.error ? ` error=${e.error.message}` : ''
      lines.push(`  [${e.severity}] ${e.category}.${e.name}${dur}${errorInfo} at ${time}`)
    }
    return lines.join('\n')
  }
}

export interface PerformanceMark {
  name: string
  timestamp: number
  category: string
  metadata?: unknown
}

export interface PerformanceMeasurement {
  name: string
  duration: number
  category: string
  startTime: number
  metadata?: unknown
}

export class PerformanceTracker {
  private marks: PerformanceMark[] = []
  private measurements: PerformanceMeasurement[] = []

  mark(name: string, category: string = 'general', metadata?: unknown): void {
    this.marks.push({ name, timestamp: Date.now(), category, metadata })
  }

  measure(name: string, fromMark: string, toMark?: string): PerformanceMeasurement | null {
    const from = this.marks.find(m => m.name === fromMark)
    if (!from) return null

    if (toMark !== undefined) {
      const to = this.marks.find(m => m.name === toMark)
      if (!to) return null
      const measurement: PerformanceMeasurement = {
        name,
        duration: to.timestamp - from.timestamp,
        category: from.category,
        startTime: from.timestamp,
        metadata: from.metadata,
      }
      this.measurements.push(measurement)
      return measurement
    }

    const measurement: PerformanceMeasurement = {
      name,
      duration: Date.now() - from.timestamp,
      category: from.category,
      startTime: from.timestamp,
      metadata: from.metadata,
    }
    this.measurements.push(measurement)
    return measurement
  }

  getMarks(name?: string): PerformanceMark[] {
    if (name !== undefined) {
      return this.marks.filter(m => m.name === name)
    }
    return [...this.marks]
  }

  clear(): void {
    this.marks = []
    this.measurements = []
  }

  getAverageDuration(name: string): number | null {
    const filtered = this.measurements.filter(m => m.name === name)
    if (filtered.length === 0) return null
    const total = filtered.reduce((sum, m) => sum + m.duration, 0)
    return total / filtered.length
  }

  getSlowOperations(thresholdMs: number = 1000): PerformanceMeasurement[] {
    return this.measurements.filter(m => m.duration > thresholdMs)
  }
}

export interface TraceSpan {
  name: string
  id: string
  parentId?: string
  startTime: number
  endTime?: number
  status: 'active' | 'completed' | 'failed'
  attributes?: Record<string, unknown>
  error?: string
}

export class SessionTracer {
  private spans: Map<string, TraceSpan> = new Map()
  private rootSpanId: string | null = null
  private idCounter: number = 0

  startRoot(name: string, attributes?: Record<string, unknown>): string {
    this.clear()
    const id = this.generateId()
    const span: TraceSpan = {
      name,
      id,
      startTime: Date.now(),
      status: 'active',
      attributes,
    }
    this.spans.set(id, span)
    this.rootSpanId = id
    return id
  }

  startSpan(name: string, parentId?: string, attributes?: Record<string, unknown>): string {
    const effectiveParentId = parentId ?? this.rootSpanId ?? undefined
    const id = this.generateId()
    const span: TraceSpan = {
      name,
      id,
      startTime: Date.now(),
      status: 'active',
      attributes,
    }
    if (effectiveParentId !== undefined) {
      span.parentId = effectiveParentId
    }
    this.spans.set(id, span)
    return id
  }

  endSpan(spanId: string, attributes?: Record<string, unknown>): void {
    const span = this.spans.get(spanId)
    if (!span) return
    span.endTime = Date.now()
    span.status = 'completed'
    if (attributes) {
      span.attributes = { ...span.attributes, ...attributes }
    }
  }

  failSpan(spanId: string, error: string): void {
    const span = this.spans.get(spanId)
    if (!span) return
    span.endTime = Date.now()
    span.status = 'failed'
    span.error = error
  }

  getSpan(spanId: string): TraceSpan | undefined {
    return this.spans.get(spanId)
  }

  getTrace(spanId?: string): TraceSpan[] {
    if (spanId !== undefined) {
      const span = this.spans.get(spanId)
      if (!span) return []
      return [span, ...this.getDescendants(spanId)]
    }
    return Array.from(this.spans.values())
  }

  getActiveSpans(): TraceSpan[] {
    return Array.from(this.spans.values()).filter(s => s.status === 'active')
  }

  export(): { traceId: string; spans: TraceSpan[]; duration: number } {
    const rootSpan = this.rootSpanId ? this.spans.get(this.rootSpanId) : null
    const traceId = rootSpan?.id ?? 'no-root'
    const spans = Array.from(this.spans.values())
    let duration = 0
    if (rootSpan) {
      const end = rootSpan.endTime ?? Date.now()
      duration = end - rootSpan.startTime
    }
    return { traceId, spans, duration }
  }

  clear(): void {
    this.spans.clear()
    this.rootSpanId = null
  }

  private generateId(): string {
    const id = `span-${++this.idCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return id
  }

  private getDescendants(parentId: string): TraceSpan[] {
    const result: TraceSpan[] = []
    for (const span of this.spans.values()) {
      if (span.parentId === parentId) {
        result.push(span)
        result.push(...this.getDescendants(span.id))
      }
    }
    return result
  }
}

let featureFlagManagerInstance: FeatureFlagManager | null = null
let eventLoggerInstance: EventLogger | null = null
let performanceTrackerInstance: PerformanceTracker | null = null
let sessionTracerInstance: SessionTracer | null = null
let analyticsBufferInstance: AnalyticsBuffer | null = null

export function getFeatureFlags(): FeatureFlagManager {
  if (!featureFlagManagerInstance) {
    featureFlagManagerInstance = new FeatureFlagManager()
    for (const flag of BUILTIN_FEATURE_FLAGS) {
      featureFlagManagerInstance.register(flag)
    }
  }
  return featureFlagManagerInstance
}

export function getEventLogger(): EventLogger {
  if (!eventLoggerInstance) {
    eventLoggerInstance = new EventLogger()
  }
  return eventLoggerInstance
}

export function getPerformanceTracker(): PerformanceTracker {
  if (!performanceTrackerInstance) {
    performanceTrackerInstance = new PerformanceTracker()
  }
  return performanceTrackerInstance
}

export function getSessionTracer(): SessionTracer {
  if (!sessionTracerInstance) {
    sessionTracerInstance = new SessionTracer()
  }
  return sessionTracerInstance
}

export function getAnalyticsBuffer(): AnalyticsBuffer {
  if (!analyticsBufferInstance) {
    analyticsBufferInstance = new AnalyticsBuffer()
  }
  return analyticsBufferInstance
}

export function logEvent(
  name: string,
  category: EventCategory = 'tool',
  severity: EventSeverity = 'info',
  properties?: Record<string, unknown>,
): void {
  const event: AnalyticsEvent = { name, category, severity, timestamp: Date.now(), properties }
  getEventLogger().log(event)
  getAnalyticsBuffer().push(event)
}

export function logError(
  error: Error | string,
  category: EventCategory = 'error',
  properties?: Record<string, unknown>,
): void {
  const message = typeof error === 'string' ? error : error.message
  const event: AnalyticsEvent = {
    name: 'error',
    category,
    severity: 'error',
    timestamp: Date.now(),
    properties,
    error: {
      message,
      ...(typeof error !== 'string' ? { stack: error.stack } : {}),
    },
  }
  getEventLogger().log(event)
  getAnalyticsBuffer().push(event)
}

export function markPerformance(name: string, category?: string, metadata?: unknown): void {
  getPerformanceTracker().mark(name, category, metadata)
}

export function measurePerformance(name: string, fromMark: string): PerformanceMeasurement | null {
  return getPerformanceTracker().measure(name, fromMark)
}

export function isFeatureEnabled(key: string): boolean {
  return getFeatureFlags().isEnabled(key)
}
