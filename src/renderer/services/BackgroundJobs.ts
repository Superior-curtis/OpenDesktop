// ============================================================================
// Background Job System (based on OpenCode's background job manager)
// Queue, processor, scheduler, and built-in handlers
// ============================================================================

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type JobPriority = 'low' | 'normal' | 'high' | 'critical'

export interface JobDefinition<T = any, R = any> {
  id: string
  type: string
  priority: JobPriority
  data: T
  createdAt: number
  startedAt?: number
  completedAt?: number
  status: JobStatus
  progress: number
  result?: R
  error?: string
  sessionId?: string
  maxRetries?: number
  retryCount?: number
  timeout?: number
  schedule?: string
  tags?: string[]
  description?: string
}

export type JobHandler<T = any, R = any> = (job: JobDefinition<T, R>, signal: AbortSignal) => Promise<R>

type StatusChangeCallback = (job: JobDefinition) => void

const PRIORITY_RANK: Record<JobPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
}

// ============================================================================
// BackgroundJobManager - queue and lifecycle
// ============================================================================

export class BackgroundJobManager {
  private jobs: Map<string, JobDefinition> = new Map()
  private handlers: Map<string, JobHandler> = new Map()
  private running: Set<string> = new Set()
  private maxConcurrent: number
  private statusChangeListeners: Set<StatusChangeCallback> = new Set()
  private completeListeners: Set<StatusChangeCallback> = new Set()
  private errorListeners: Set<StatusChangeCallback> = new Set()
  private abortControllers: Map<string, AbortController> = new Map()

  constructor(maxConcurrent?: number) {
    this.maxConcurrent = maxConcurrent ?? 5
  }

  register<T, R>(type: string, handler: JobHandler<T, R>): void {
    this.handlers.set(type, handler as JobHandler)
  }

  unregister(type: string): boolean {
    return this.handlers.delete(type)
  }

  enqueue<T, R>(job: Omit<JobDefinition<T, R>, 'id' | 'createdAt' | 'status' | 'progress'>): string {
    const id = crypto.randomUUID()
    const entry: JobDefinition = {
      ...job,
      id,
      createdAt: Date.now(),
      status: 'pending',
      progress: 0,
    }
    this.jobs.set(id, entry)
    this.notify(entry)
    return id
  }

  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false
    if (job.status === 'completed' || job.status === 'cancelled') return false

    const controller = this.abortControllers.get(jobId)
    if (controller) {
      controller.abort()
      this.abortControllers.delete(jobId)
    }

    job.status = 'cancelled'
    job.completedAt = Date.now()
    this.running.delete(jobId)
    this.notify(job)
    return true
  }

  cancelBySession(sessionId: string): number {
    let count = 0
    for (const [id, job] of this.jobs) {
      if (job.sessionId === sessionId && (job.status === 'pending' || job.status === 'running')) {
        if (this.cancel(id)) count++
      }
    }
    return count
  }

  get(jobId: string): JobDefinition | undefined {
    return this.jobs.get(jobId)
  }

  list(filter?: { status?: JobStatus; type?: string; sessionId?: string }): JobDefinition[] {
    const all = Array.from(this.jobs.values())
    if (!filter) return all
    return all.filter(j => {
      if (filter.status && j.status !== filter.status) return false
      if (filter.type && j.type !== filter.type) return false
      if (filter.sessionId && j.sessionId !== filter.sessionId) return false
      return true
    })
  }

  getQueue(): JobDefinition[] {
    return this.list({ status: 'pending' }).sort(
      (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.createdAt - b.createdAt
    )
  }

  getRunning(): JobDefinition[] {
    return this.list({ status: 'running' })
  }

  getStats() {
    const stats = { total: 0, pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 }
    stats.total = this.jobs.size
    for (const job of this.jobs.values()) {
      switch (job.status) {
        case 'pending': stats.pending++; break
        case 'running': stats.running++; break
        case 'completed': stats.completed++; break
        case 'failed': stats.failed++; break
        case 'cancelled': stats.cancelled++; break
      }
    }
    return stats
  }

  clearCompleted(): void {
    for (const [id, job] of this.jobs) {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        this.jobs.delete(id)
      }
    }
  }

  clearAll(): void {
    for (const id of this.running) {
      this.cancel(id)
    }
    this.jobs.clear()
  }

  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusChangeListeners.add(callback)
    return () => { this.statusChangeListeners.delete(callback) }
  }

  onComplete(callback: StatusChangeCallback): () => void {
    this.completeListeners.add(callback)
    return () => { this.completeListeners.delete(callback) }
  }

  onError(callback: StatusChangeCallback): () => void {
    this.errorListeners.add(callback)
    return () => { this.errorListeners.delete(callback) }
  }

  // Internal helpers used by JobProcessor

  getHandler(type: string): JobHandler | undefined {
    return this.handlers.get(type)
  }

  hasHandler(type: string): boolean {
    return this.handlers.has(type)
  }

  getMaxConcurrent(): number {
    return this.maxConcurrent
  }

  getRunningCount(): number {
    return this.running.size
  }

  setRunning(jobId: string, running: boolean): void {
    if (running) this.running.add(jobId)
    else this.running.delete(jobId)
  }

  setAbortController(jobId: string, controller: AbortController): void {
    this.abortControllers.set(jobId, controller)
  }

  removeAbortController(jobId: string): void {
    this.abortControllers.delete(jobId)
  }

  updateJob(jobId: string, updates: Partial<JobDefinition>): void {
    const job = this.jobs.get(jobId)
    if (!job) return
    Object.assign(job, updates)
    this.notify(job)
  }

  private notify(job: JobDefinition): void {
    for (const cb of this.statusChangeListeners) {
      try { cb(job) } catch { /* ignore listener error */ }
    }
    if (job.status === 'completed') {
      for (const cb of this.completeListeners) {
        try { cb(job) } catch { /* ignore listener error */ }
      }
    }
    if (job.status === 'failed') {
      for (const cb of this.errorListeners) {
        try { cb(job) } catch { /* ignore listener error */ }
      }
    }
  }
}

// ============================================================================
// JobProcessor - polls and executes pending jobs
// ============================================================================

export class JobProcessor {
  private manager: BackgroundJobManager
  private running: boolean = false
  private pollInterval: number
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(manager: BackgroundJobManager, pollInterval?: number) {
    this.manager = manager
    this.pollInterval = pollInterval ?? 1000
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.timer = setInterval(() => { this.processPending() }, this.pollInterval)
    this.processPending()
  }

  stop(): void {
    this.running = false
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  isRunning(): boolean {
    return this.running
  }

  async processPending(): Promise<void> {
    if (!this.running) return

    const queue = this.manager.getQueue()
    const available = this.manager.getMaxConcurrent() - this.manager.getRunningCount()
    const toProcess = queue.slice(0, available)

    await Promise.all(toProcess.map(job => this.executeJob(job.id)))
  }

  private async executeJob(jobId: string): Promise<void> {
    const job = this.manager.get(jobId)
    if (!job) return

    const handler = this.manager.getHandler(job.type)
    if (!handler) {
      this.manager.updateJob(jobId, {
        status: 'failed',
        error: `No handler registered for job type: ${job.type}`,
        completedAt: Date.now(),
      })
      return
    }

    const controller = new AbortController()
    this.manager.setAbortController(jobId, controller)
    this.manager.setRunning(jobId, true)
    this.manager.updateJob(jobId, { status: 'running', startedAt: Date.now(), progress: 0, retryCount: job.retryCount ?? 0 })

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    if (typeof job.timeout === 'number' && job.timeout > 0) {
      timeoutId = setTimeout(() => { controller.abort() }, job.timeout)
    }

    try {
      const result = await handler(job, controller.signal)
      this.manager.updateJob(jobId, {
        status: 'completed',
        result,
        progress: 1,
        completedAt: Date.now(),
      })
    } catch (err) {
      if (controller.signal.aborted) {
        this.manager.updateJob(jobId, {
          status: 'cancelled',
          error: 'Job was cancelled or timed out',
          completedAt: Date.now(),
        })
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err)
        const retryCount = (job.retryCount ?? 0) + 1
        const maxRetries = job.maxRetries ?? 0

        if (retryCount <= maxRetries) {
          this.manager.updateJob(jobId, {
            status: 'pending',
            retryCount,
            progress: 0,
          })
        } else {
          this.manager.updateJob(jobId, {
            status: 'failed',
            error: errorMessage,
            completedAt: Date.now(),
          })
        }
      }
    } finally {
      this.manager.setRunning(jobId, false)
      this.manager.removeAbortController(jobId)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }
}

// ============================================================================
// Cron Matching
// ============================================================================

function matchCronField(pattern: string, value: number): boolean {
  if (pattern === '*') return true
  for (const part of pattern.split(',')) {
    if (parseInt(part, 10) === value) return true
  }
  return false
}

export function matchCron(cron: string, date: Date): boolean {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return false

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  return (
    matchCronField(minute, date.getMinutes()) &&
    matchCronField(hour, date.getHours()) &&
    matchCronField(dayOfMonth, date.getDate()) &&
    matchCronField(month, date.getMonth() + 1) &&
    matchCronField(dayOfWeek, date.getDay())
  )
}

// ============================================================================
// JobScheduler - cron-based recurring job scheduling
// ============================================================================

export interface ScheduleEntry {
  id: string
  type: string
  cron: string
  priority: JobPriority
  data: any
  lastRun?: number
  nextRun?: number
}

export class JobScheduler {
  private entries: Map<string, ScheduleEntry> = new Map()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private manager: BackgroundJobManager) {}

  add(entry: Omit<ScheduleEntry, 'id'>): string {
    const id = crypto.randomUUID()
    const full: ScheduleEntry = { ...entry, id }
    this.entries.set(id, full)
    return id
  }

  remove(id: string): boolean {
    return this.entries.delete(id)
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), 60_000)
    this.tick()
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getSchedule(): ScheduleEntry[] {
    return Array.from(this.entries.values())
  }

  private tick(): void {
    const now = new Date()
    const nowMs = now.getTime()
    for (const entry of this.entries.values()) {
      if (matchCron(entry.cron, now)) {
        if (entry.lastRun && nowMs - entry.lastRun < 60_000) continue
        entry.lastRun = nowMs
        this.manager.enqueue({
          type: entry.type,
          priority: entry.priority,
          data: entry.data,
        })
      }
    }
  }
}

// ============================================================================
// Built-in Job Handlers
// ============================================================================

import { compactConversation } from './ContextCompaction'

export function registerBuiltinHandlers(manager: BackgroundJobManager): void {
  manager.register<any, any>('compaction', async (job, _signal) => {
    const messages = job.data?.messages ?? []
    const model = job.data?.model ?? 'default'
    const result = await compactConversation(messages, model)
    return {
      preCompactTokenCount: result.preCompactTokenCount,
      postCompactTokenCount: result.postCompactTokenCount,
    }
  })

  manager.register<any, any>('skill-sync', async (job, _signal) => {
    const urls: string[] = job.data?.urls ?? []
    const results: { url: string; ok: boolean }[] = []
    for (const url of urls) {
      try {
        const res = await fetch(url)
        if (res.ok) {
          await res.text()
          results.push({ url, ok: true })
        } else {
          results.push({ url, ok: false })
        }
      } catch {
        results.push({ url, ok: false })
      }
    }
    return { synced: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length }
  })

  manager.register<any, any>('session-cleanup', async (job, _signal) => {
    const maxAge = job.data?.maxAge ?? 30 * 24 * 60 * 60 * 1000
    const days = Math.ceil(maxAge / (24 * 60 * 60 * 1000))
    let cleaned = 0
    try {
      const result = await window.api.executeCommand(
        `Get-ChildItem -Path "${String(job.data?.dir ?? '')}" -Filter *.json | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-${days}) } | ForEach-Object { Remove-Item $_.FullName -Force; $_.FullName }`,
        { timeout: 15000 }
      )
      if (result.exitCode === 0 && result.stdout.trim()) {
        cleaned = result.stdout.trim().split('\n').filter(Boolean).length
      }
    } catch { /* cleanup handles gracefully */ }
    return { cleaned, maxAge }
  })

  manager.register<any, any>('truncation-cleanup', async (job, _signal) => {
    const dir = String(job.data?.dir ?? '')
    let cleaned = 0
    try {
      const result = await window.api.executeCommand(
        `Get-ChildItem -Path "${dir}" -Filter *truncated* -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | ForEach-Object { Remove-Item $_.FullName -Force; $_.FullName }`,
        { timeout: 15000 }
      )
      if (result.exitCode === 0 && result.stdout.trim()) {
        cleaned = result.stdout.trim().split('\n').filter(Boolean).length
      }
    } catch { /* cleanup handles gracefully */ }
    return { cleaned }
  })

  manager.register<any, any>('file-watch', async (job, signal) => {
    const target = String(job.data?.target ?? '')
    const pollInterval = (job.data?.pollInterval as number) ?? 2000
    return new Promise<void>((resolve) => {
      const timer = setInterval(async () => {
        if (signal.aborted) {
          clearInterval(timer)
          resolve()
          return
        }
        try {
          await window.api.executeCommand(
            `(Get-Item "${target.replace(/"/g, '`"')}").LastWriteTime.ToString("O")`,
            { timeout: 3000 }
          )
        } catch { /* file may not exist yet */ }
      }, pollInterval)
    })
  })

  manager.register<any, any>('auto-save', async (job, _signal) => {
    const path = String(job.data?.path ?? '')
    const state = job.data?.state
    if (path && state !== undefined) {
      try {
        await window.api.writeFile(path, JSON.stringify(state, null, 2))
      } catch { /* save failure is non-fatal */ }
    }
    return { saved: true, timestamp: Date.now() }
  })
}

// ============================================================================
// Singleton Convenience Exports
// ============================================================================

let globalManager: BackgroundJobManager | null = null
let globalProcessor: JobProcessor | null = null
let globalScheduler: JobScheduler | null = null

export function getJobManager(): BackgroundJobManager {
  if (!globalManager) globalManager = new BackgroundJobManager()
  return globalManager
}

export function getJobProcessor(): JobProcessor {
  if (!globalProcessor) globalProcessor = new JobProcessor(getJobManager())
  return globalProcessor
}

export function getJobScheduler(): JobScheduler {
  if (!globalScheduler) globalScheduler = new JobScheduler(getJobManager())
  return globalScheduler
}
