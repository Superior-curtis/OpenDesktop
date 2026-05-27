// ============================================================================
// Streaming Tool Executor (based on Claude Code's concurrent tool execution)
// Max concurrent tools: 10
// ============================================================================

import type { Tool, ToolContext, ToolResult } from './Tool'

export interface ToolCallInfo {
  id: string
  name: string
  input: Record<string, any>
  status: 'queued' | 'executing' | 'completed' | 'failed' | 'cancelled'
  isConcurrencySafe: boolean
  startedAt: number
  completedAt: number | null
  result: string | null
  error: string | null
  progress: string[]
}

export interface ToolExecutionEvent {
  type: 'tool_started' | 'tool_progress' | 'tool_completed' | 'tool_failed' | 'tool_cancelled'
  toolCallId: string
  toolName: string
  result?: string
  error?: string
  progress?: string
  duration?: number
}

export const MAX_CONCURRENT_TOOLS = 10

export type ToolExecutionCallback = (event: ToolExecutionEvent) => void

// ============================================================================
// Streaming Tool Executor
// ============================================================================

export class StreamingToolExecutor {
  private tools: Map<string, Tool> = new Map()
  private activeExecutions: Map<string, Promise<ToolResult>> = new Map()
  private callbacks: Set<ToolExecutionCallback> = new Set()
  private abortController: AbortController

  constructor(tools: Tool[]) {
    for (const tool of tools) {
      this.tools.set(tool.name, tool)
    }
    this.abortController = new AbortController()
  }

  on(callback: ToolExecutionCallback): () => void {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  private emit(event: ToolExecutionEvent): void {
    for (const cb of this.callbacks) {
      try { cb(event) } catch { /* ignore listener errors */ }
    }
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  removeTool(name: string): void {
    this.tools.delete(name)
  }

  // ============================================================================
  // Concurrent Execution Pipeline
  // ============================================================================

  async executeToolCalls(
    toolCalls: ToolCallInfo[],
    context: ToolContext,
  ): Promise<ToolCallInfo[]> {
    const updatedCalls = [...toolCalls]

    // Phase 1: Separate concurrency-safe and non-safe calls
    const safeCalls: ToolCallInfo[] = []
    const unsafeCalls: ToolCallInfo[] = []

    for (const call of updatedCalls) {
      const tool = this.tools.get(call.name)
      if (!tool) {
        call.status = 'failed'
        call.error = `Tool not found: ${call.name}`
        call.completedAt = Date.now()
        this.emit({
          type: 'tool_failed',
          toolCallId: call.id,
          toolName: call.name,
          error: call.error,
        })
        continue
      }

      try {
        call.isConcurrencySafe = tool.isConcurrencySafe(call.input)
        if (call.isConcurrencySafe) {
          safeCalls.push(call)
        } else {
          unsafeCalls.push(call)
        }
      } catch {
        call.isConcurrencySafe = false
        unsafeCalls.push(call)
      }
    }

    // Phase 2: Execute safe calls in parallel (up to MAX_CONCURRENT_TOOLS)
    const safePromises = this.executeBatch(safeCalls, context)

    // Phase 3: Execute unsafe calls sequentially
    const unsafePromise = this.executeSequential(unsafeCalls, context)

    // Phase 4: Wait for all
    await Promise.all([safePromises, unsafePromise])

    return updatedCalls
  }

  private async executeBatch(
    calls: ToolCallInfo[],
    context: ToolContext,
  ): Promise<void> {
    // Process in chunks of MAX_CONCURRENT_TOOLS
    for (let i = 0; i < calls.length; i += MAX_CONCURRENT_TOOLS) {
      const batch = calls.slice(i, i + MAX_CONCURRENT_TOOLS)
      await Promise.all(batch.map(call => this.executeSingle(call, context)))
    }
  }

  private async executeSequential(
    calls: ToolCallInfo[],
    context: ToolContext,
  ): Promise<void> {
    for (const call of calls) {
      if (this.abortController.signal.aborted) {
        call.status = 'cancelled'
        call.error = 'Execution aborted'
        call.completedAt = Date.now()
        this.emit({
          type: 'tool_cancelled',
          toolCallId: call.id,
          toolName: call.name,
          error: 'Execution aborted',
        })
        return
      }
      await this.executeSingle(call, context)
    }
  }

  private async executeSingle(
    call: ToolCallInfo,
    context: ToolContext,
  ): Promise<void> {
    const tool = this.tools.get(call.name)
    if (!tool) {
      call.status = 'failed'
      call.error = `Tool not found: ${call.name}`
      call.completedAt = Date.now()
      return
    }

    call.status = 'executing'
    call.startedAt = Date.now()
    this.emit({
      type: 'tool_started',
      toolCallId: call.id,
      toolName: call.name,
    })

    try {
      const result = await tool.call(
        call.input,
        context,
        (progress) => {
          call.progress.push(progress.message)
          this.emit({
            type: 'tool_progress',
            toolCallId: call.id,
            toolName: call.name,
            progress: progress.message,
          })
        },
      )

      call.status = 'completed'
      call.result = result.content
      call.completedAt = Date.now()
      this.emit({
        type: 'tool_completed',
        toolCallId: call.id,
        toolName: call.name,
        result: result.content,
        duration: call.completedAt - call.startedAt,
      })
    } catch (error) {
      call.status = 'failed'
      call.error = error instanceof Error ? error.message : 'Unknown error'
      call.completedAt = Date.now()
      this.emit({
        type: 'tool_failed',
        toolCallId: call.id,
        toolName: call.name,
        error: call.error,
        duration: call.completedAt - call.startedAt,
      })
    }
  }

  abort(): void {
    this.abortController.abort()
  }

  hasActiveExecutions(): boolean {
    return this.activeExecutions.size > 0
  }

  getActiveCount(): number {
    return this.activeExecutions.size
  }

  dispose(): void {
    this.abort()
    this.callbacks.clear()
    this.tools.clear()
    this.activeExecutions.clear()
  }
}
