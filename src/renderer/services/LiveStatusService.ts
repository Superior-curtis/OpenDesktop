export interface ActiveToolCall {
  id: string
  name: string
  status: 'executing' | 'completed' | 'failed'
  progress: string[]
  startedAt: number
}

export interface LiveStatus {
  thinkingContent: string
  tokenUsage: {
    current: number
    limit: number
    percentage: number
  }
  turnCount: {
    current: number
    limit: number
    percentage: number
  }
  contextWindow: {
    used: number
    total: number
    percentage: number
  }
  activeTools: string[]
  activeToolCalls: ActiveToolCall[]
  activeAgents: string[]
  lastToolCall: {
    id: string
    name: string
    status: string
    timestamp: number
  } | null
  compactStatus: {
    triggered: boolean
    lastCompactAt: number | null
    failures: number
  }
  isThinking: boolean
  isExecuting: boolean
  isWaitingForUser: boolean
  isRunning: boolean
  error: string | null
}

export class LiveStatusService {
  private status: LiveStatus = {
    thinkingContent: '',
    tokenUsage: { current: 0, limit: 100000, percentage: 0 },
    turnCount: { current: 0, limit: 100, percentage: 0 },
    contextWindow: { used: 0, total: 128000, percentage: 0 },
    activeTools: [],
    activeToolCalls: [],
    activeAgents: [],
    lastToolCall: null,
    compactStatus: { triggered: false, lastCompactAt: null, failures: 0 },
    isThinking: false,
    isExecuting: false,
    isWaitingForUser: false,
    isRunning: false,
    error: null,
  }

  private listeners: Set<(status: LiveStatus) => void> = new Set()

  subscribe(listener: (status: LiveStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getStatus(): LiveStatus {
    return { ...this.status }
  }

  updateTokenUsage(current: number, limit: number) {
    this.status.tokenUsage = {
      current,
      limit,
      percentage: Math.min((current / limit) * 100, 100),
    }
    this.notify()
  }

  updateTurnCount(current: number, limit: number) {
    this.status.turnCount = {
      current,
      limit,
      percentage: Math.min((current / limit) * 100, 100),
    }
    this.notify()
  }

  updateContextWindow(used: number, total: number) {
    this.status.contextWindow = {
      used,
      total,
      percentage: Math.min((used / total) * 100, 100),
    }
    this.notify()
  }

  addActiveToolCall(id: string, name: string) {
    const call: ActiveToolCall = {
      id, name,
      status: 'executing',
      progress: [],
      startedAt: Date.now(),
    }
    this.status.activeToolCalls = [...this.status.activeToolCalls, call]
    this.status.activeTools = this.status.activeToolCalls.map((c) => c.name)
    this.notify()
  }

  updateToolCallProgress(id: string, progress: string) {
    this.status.activeToolCalls = this.status.activeToolCalls.map((c) =>
      c.id === id ? { ...c, progress: [...c.progress, progress] } : c,
    )
    this.notify()
  }

  completeToolCall(id: string, success: boolean) {
    this.status.activeToolCalls = this.status.activeToolCalls.map((c) =>
      c.id === id ? { ...c, status: success ? 'completed' : 'failed' } : c,
    )
    this.status.lastToolCall = (() => {
      const call = this.status.activeToolCalls.find((c) => c.id === id)
      return call ? { id: call.id, name: call.name, status: call.status, timestamp: Date.now() } : this.status.lastToolCall
    })()
    // Remove completed/failed calls after a brief delay
    setTimeout(() => {
      this.status.activeToolCalls = this.status.activeToolCalls.filter((c) => c.status === 'executing')
      this.status.activeTools = this.status.activeToolCalls.map((c) => c.name)
      this.notify()
    }, 2000)
    this.notify()
  }

  setActiveTools(tools: string[]) {
    this.status.activeTools = tools
    this.notify()
  }

  setActiveAgents(agents: string[]) {
    this.status.activeAgents = agents
    this.notify()
  }

  setLastToolCall(id: string, name: string, status: string) {
    this.status.lastToolCall = {
      id,
      name,
      status,
      timestamp: Date.now(),
    }
    this.notify()
  }

  setCompactStatus(triggered: boolean, failures: number) {
    this.status.compactStatus = {
      triggered,
      lastCompactAt: triggered ? Date.now() : this.status.compactStatus.lastCompactAt,
      failures,
    }
    this.notify()
  }

  setIsThinking(thinking: boolean) {
    this.status.isThinking = thinking
    this.notify()
  }

  setThinkingContent(content: string) {
    this.status.thinkingContent = content
    this.notify()
  }

  setIsExecuting(executing: boolean) {
    this.status.isExecuting = executing
    this.notify()
  }

  setIsWaitingForUser(waiting: boolean) {
    this.status.isWaitingForUser = waiting
    this.notify()
  }

  setIsRunning(running: boolean) {
    this.status.isRunning = running
    this.notify()
  }

  setError(error: string | null) {
    this.status.error = error
    this.notify()
  }

  reset() {
    this.status = {
      thinkingContent: '',
      tokenUsage: { current: 0, limit: 100000, percentage: 0 },
      turnCount: { current: 0, limit: 100, percentage: 0 },
      contextWindow: { used: 0, total: 128000, percentage: 0 },
      activeTools: [],
      activeToolCalls: [],
      activeAgents: [],
      lastToolCall: null,
      compactStatus: { triggered: false, lastCompactAt: null, failures: 0 },
      isThinking: false,
      isExecuting: false,
      isWaitingForUser: false,
      isRunning: false,
      error: null,
    }
    this.notify()
  }

  private notify() {
    this.listeners.forEach((listener) => listener({ ...this.status }))
  }
}

export const liveStatusService = new LiveStatusService()
