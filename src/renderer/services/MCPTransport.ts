// ============================================================================
// MCP Transport Layer (based on @modelcontextprotocol/sdk transport pattern)
// Pluggable transports: stdio (via window.api.executeCommand), SSE, HTTP.
// No external dependencies — all types defined in-file.
// ============================================================================

import { McpServerConfigUnion } from './MCPClient'

// ============================================================================
// Transport Types
// ============================================================================

export type TransportType = 'stdio' | 'sse' | 'http' | 'ws'
export type TransportState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'failed'

export interface TransportOptions {
  serverName: string
  timeout?: number
  signal?: AbortSignal
}

export interface TransportEvent {
  type: 'message' | 'error' | 'close' | 'open'
  data?: any
}

// ============================================================================
// JSON-RPC Message Types (MCP Specification)
// ============================================================================

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: any
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: any
}

// ============================================================================
// Error Types
// ============================================================================

export class TransportError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean,
  ) {
    super(message)
    this.name = 'TransportError'
  }
}

export class ConnectionTimeoutError extends TransportError {
  constructor(message: string = 'Connection timed out') {
    super(message, 'CONNECTION_TIMEOUT', true)
    this.name = 'ConnectionTimeoutError'
  }
}

export class ConnectionRefusedError extends TransportError {
  constructor(message: string = 'Connection refused') {
    super(message, 'CONNECTION_REFUSED', false)
    this.name = 'ConnectionRefusedError'
  }
}

// ============================================================================
// Abstract Transport
// ============================================================================

export abstract class Transport {
  abstract readonly type: TransportType
  abstract readonly state: TransportState

  abstract connect(options: TransportOptions): Promise<void>
  abstract disconnect(): Promise<void>
  abstract send(message: unknown): Promise<void>
  abstract on(event: TransportEvent['type'], callback: (data?: any) => void): () => void
  abstract getState(): TransportState
}

// ============================================================================
// Utility
// ============================================================================

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context: string,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false

    const handleAbort = () => {
      if (!settled) {
        settled = true
        reject(new TransportError(`${context} was aborted`, 'ABORTED', true))
      }
    }

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new ConnectionTimeoutError(`${context} timed out after ${timeoutMs}ms`))
      }
    }, timeoutMs)

    if (signal?.aborted) {
      clearTimeout(timer)
      reject(new TransportError(`${context} was aborted`, 'ABORTED', true))
      return
    }

    const abortHandler = signal ? handleAbort : undefined
    if (abortHandler) signal!.addEventListener('abort', abortHandler, { once: true })

    promise.then(
      (result) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          if (abortHandler) signal?.removeEventListener('abort', abortHandler)
          resolve(result)
        }
      },
      (error: unknown) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          if (abortHandler) signal?.removeEventListener('abort', abortHandler)
          reject(error)
        }
      },
    )
  })
}

function combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal | undefined {
  const valid = signals.filter((s): s is AbortSignal => s !== undefined)
  if (valid.length === 0) return undefined
  if (valid.length === 1) return valid[0]

  const controller = new AbortController()
  for (const sig of valid) {
    if (sig.aborted) {
      controller.abort(sig.reason)
      return controller.signal
    }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true })
  }
  return controller.signal
}

// ============================================================================
// StdioTransport
// Spawns a child process via window.api.executeCommand, communicates over
// stdin/stdout with JSON-RPC line-delimited messages.
// ============================================================================

export class StdioTransport extends Transport {
  readonly type: TransportType = 'stdio'
  private _state: TransportState = 'disconnected'
  private _command: string
  private _args: string[]
  private _env: Record<string, string> | undefined
  private _timeout: number
  private _options: TransportOptions | null = null
  private _abortController: AbortController | null = null
  private _listeners: Map<string, Array<(data?: any) => void>> = new Map()

  get state(): TransportState {
    return this._state
  }

  constructor(config: McpServerConfigUnion & { transport: 'stdio' }, options?: { timeout?: number }) {
    super()
    this._command = config.command
    this._args = config.args
    this._env = config.env
    this._timeout = options?.timeout ?? 30000
  }

  private _setState(s: TransportState): void {
    this._state = s
  }

  private _emit(event: string, data?: any): void {
    const handlers = this._listeners.get(event)
    if (handlers) {
      for (const h of handlers) h(data)
    }
  }

  async connect(options: TransportOptions): Promise<void> {
    if (this._state === 'connected' || this._state === 'connecting') return

    this._setState('connecting')
    this._options = options
    this._abortController = new AbortController()

    const timeout = options.timeout ?? this._timeout
    const combinedSignal = combineSignals(this._abortController.signal, options.signal)

    try {
      // Verify the command starts by running it with a brief check
      await withTimeout(
        window.api.executeCommand(this._command, { args: this._args, env: this._env }),
        timeout,
        `StdioTransport.connect(${options.serverName})`,
        combinedSignal,
      )

      this._setState('connected')
      this._emit('open', { serverName: options.serverName })
    } catch (error: unknown) {
      this._setState('failed')
      const err = error instanceof TransportError
        ? error
        : new ConnectionRefusedError(
            `Failed to start process: ${error instanceof Error ? error.message : String(error)}`,
          )
      this._emit('error', err)
      throw err
    }
  }

  async disconnect(): Promise<void> {
    if (this._state === 'disconnected') return

    this._setState('disconnecting')
    this._abortController?.abort()
    this._abortController = null
    this._options = null
    this._setState('disconnected')
    this._emit('close')
  }

  async send(message: unknown): Promise<void> {
    if (this._state !== 'connected') {
      throw new TransportError('Transport not connected', 'NOT_CONNECTED', true)
    }

    const timeout = this._options?.timeout ?? this._timeout
    const combinedSignal = combineSignals(this._abortController?.signal, this._options?.signal)

    try {
      const result = await withTimeout(
        window.api.executeCommand(this._command, {
          args: this._args,
          env: this._env,
          stdin: JSON.stringify(message),
        }),
        timeout,
        `StdioTransport.send(${this._options?.serverName ?? 'unknown'})`,
        combinedSignal,
      )

      if (result.exitCode !== 0 && result.stderr) {
        this._emit(
          'error',
          new TransportError(
            `Process exited with code ${result.exitCode}: ${result.stderr}`,
            'PROCESS_ERROR',
            true,
          ),
        )
      }

      if (result.stdout) {
        try {
          const parsed = JSON.parse(result.stdout)
          this._emit('message', parsed)
        } catch {
          this._emit('message', result.stdout)
        }
      }
    } catch (error: unknown) {
      if (error instanceof TransportError) throw error
      throw new TransportError(
        `Send failed: ${error instanceof Error ? error.message : String(error)}`,
        'SEND_ERROR',
        true,
      )
    }
  }

  on(event: TransportEvent['type'], callback: (data?: any) => void): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, [])
    }
    this._listeners.get(event)!.push(callback)
    return () => {
      const handlers = this._listeners.get(event)
      if (handlers) {
        const idx = handlers.indexOf(callback)
        if (idx >= 0) handlers.splice(idx, 1)
      }
    }
  }

  getState(): TransportState {
    return this._state
  }
}

// ============================================================================
// SSETransport
// Connects to an SSE endpoint (GET for stream, POST for sending).
// Uses fetch() and ReadableStream for server-sent events.
// ============================================================================

export class SSETransport extends Transport {
  readonly type: TransportType = 'sse'
  private _state: TransportState = 'disconnected'
  private _url: string
  private _headers: Record<string, string>
  private _timeout: number
  private _options: TransportOptions | null = null
  private _abortController: AbortController | null = null
  private _listeners: Map<string, Array<(data?: any) => void>> = new Map()
  private _reader: ReadableStreamDefaultReader<Uint8Array> | null = null

  get state(): TransportState {
    return this._state
  }

  constructor(config: McpServerConfigUnion & { transport: 'sse' }, options?: { timeout?: number }) {
    super()
    this._url = config.url
    this._headers = config.headers ?? {}
    this._timeout = options?.timeout ?? 30000
  }

  private _setState(s: TransportState): void {
    this._state = s
  }

  private _emit(event: string, data?: any): void {
    const handlers = this._listeners.get(event)
    if (handlers) {
      for (const h of handlers) h(data)
    }
  }

  async connect(options: TransportOptions): Promise<void> {
    if (this._state === 'connected' || this._state === 'connecting') return

    this._setState('connecting')
    this._options = options
    this._abortController = new AbortController()

    const timeout = options.timeout ?? this._timeout
    const combinedSignal = combineSignals(this._abortController.signal, options.signal)

    try {
      const response = await withTimeout(
        fetch(this._url, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            'Cache-Control': 'no-cache',
            ...this._headers,
          },
          signal: combinedSignal,
        }),
        timeout,
        `SSETransport.connect(${options.serverName})`,
        combinedSignal,
      )

      if (!response.ok) {
        throw new ConnectionRefusedError(
          `SSE connection failed: ${response.status} ${response.statusText}`,
        )
      }

      this._setState('connected')
      this._emit('open', { serverName: options.serverName })

      // Start reading SSE stream in background
      if (response.body) {
        this._reader = response.body.getReader()
        this._readLoop().catch((error: unknown) => {
          if (error instanceof Error && error.name === 'AbortError') return
          this._setState('failed')
          this._emit('error', error)
        })
      }
    } catch (error: unknown) {
      this._setState('failed')
      const err = error instanceof TransportError
        ? error
        : new ConnectionRefusedError(
            `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
          )
      this._emit('error', err)
      throw err
    }
  }

  private async _readLoop(): Promise<void> {
    const decoder = new TextDecoder()
    let buffer = ''

    while (this._state === 'connected' && this._reader) {
      const { done, value } = await this._reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Parse SSE events delimited by double newlines
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const lines = part.split('\n')
        let eventData = ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            eventData += line.slice(6)
          } else if (line.startsWith('data:')) {
            eventData += line.slice(5)
          }
        }

        if (eventData) {
          try {
            const parsed = JSON.parse(eventData)
            this._emit('message', parsed)
          } catch {
            this._emit('message', eventData)
          }
        }
      }
    }
  }

  async send(message: unknown): Promise<void> {
    if (this._state !== 'connected') {
      throw new TransportError('Transport not connected', 'NOT_CONNECTED', true)
    }

    const timeout = this._options?.timeout ?? this._timeout
    const combinedSignal = combineSignals(this._abortController?.signal, this._options?.signal)

    try {
      const response = await withTimeout(
        fetch(this._url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this._headers,
          },
          body: JSON.stringify(message),
          signal: combinedSignal,
        }),
        timeout,
        `SSETransport.send(${this._options?.serverName ?? 'unknown'})`,
        combinedSignal,
      )

      if (!response.ok) {
        throw new TransportError(
          `POST failed: ${response.status} ${response.statusText}`,
          'HTTP_ERROR',
          true,
        )
      }

      const text = await response.text()
      if (text) {
        try {
          const parsed = JSON.parse(text)
          this._emit('message', parsed)
        } catch {
          this._emit('message', text)
        }
      }
    } catch (error: unknown) {
      if (error instanceof TransportError) throw error
      throw new TransportError(
        `Send failed: ${error instanceof Error ? error.message : String(error)}`,
        'SEND_ERROR',
        true,
      )
    }
  }

  async disconnect(): Promise<void> {
    if (this._state === 'disconnected') return

    this._setState('disconnecting')

    if (this._reader) {
      try {
        await this._reader.cancel()
      } catch {
        // Reader may already be closed
      }
      this._reader = null
    }

    this._abortController?.abort()
    this._abortController = null
    this._options = null
    this._setState('disconnected')
    this._emit('close')
  }

  on(event: TransportEvent['type'], callback: (data?: any) => void): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, [])
    }
    this._listeners.get(event)!.push(callback)
    return () => {
      const handlers = this._listeners.get(event)
      if (handlers) {
        const idx = handlers.indexOf(callback)
        if (idx >= 0) handlers.splice(idx, 1)
      }
    }
  }

  getState(): TransportState {
    return this._state
  }
}

// ============================================================================
// HttpTransport
// Simple HTTP POST transport with JSON-RPC request/response.
// ============================================================================

export class HttpTransport extends Transport {
  readonly type: TransportType = 'http'
  private _state: TransportState = 'disconnected'
  private _url: string
  private _headers: Record<string, string>
  private _timeout: number
  private _options: TransportOptions | null = null
  private _abortController: AbortController | null = null
  private _listeners: Map<string, Array<(data?: any) => void>> = new Map()

  get state(): TransportState {
    return this._state
  }

  constructor(config: McpServerConfigUnion & { transport: 'http' }, options?: { timeout?: number }) {
    super()
    this._url = config.url
    this._headers = config.headers ?? {}
    this._timeout = options?.timeout ?? 30000
  }

  private _setState(s: TransportState): void {
    this._state = s
  }

  private _emit(event: string, data?: any): void {
    const handlers = this._listeners.get(event)
    if (handlers) {
      for (const h of handlers) h(data)
    }
  }

  async connect(options: TransportOptions): Promise<void> {
    if (this._state === 'connected' || this._state === 'connecting') return

    this._setState('connecting')
    this._options = options
    this._abortController = new AbortController()

    const timeout = options.timeout ?? this._timeout
    const combinedSignal = combineSignals(this._abortController.signal, options.signal)

    try {
      // Test connectivity with a GET or OPTIONS request
      const response = await withTimeout(
        fetch(this._url, {
          method: 'GET',
          headers: { Accept: 'application/json', ...this._headers },
          signal: combinedSignal,
        }),
        timeout,
        `HttpTransport.connect(${options.serverName})`,
        combinedSignal,
      )

      // 405 Method Not Allowed is acceptable if the endpoint only accepts POST
      if (!response.ok && response.status !== 405) {
        throw new ConnectionRefusedError(
          `HTTP connection check failed: ${response.status} ${response.statusText}`,
        )
      }

      this._setState('connected')
      this._emit('open', { serverName: options.serverName })
    } catch (error: unknown) {
      this._setState('failed')
      const err = error instanceof TransportError
        ? error
        : new ConnectionRefusedError(
            `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
          )
      this._emit('error', err)
      throw err
    }
  }

  async send(message: unknown): Promise<void> {
    if (this._state !== 'connected') {
      throw new TransportError('Transport not connected', 'NOT_CONNECTED', true)
    }

    const timeout = this._options?.timeout ?? this._timeout
    const combinedSignal = combineSignals(this._abortController?.signal, this._options?.signal)

    try {
      const response = await withTimeout(
        fetch(this._url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...this._headers,
          },
          body: JSON.stringify(message),
          signal: combinedSignal,
        }),
        timeout,
        `HttpTransport.send(${this._options?.serverName ?? 'unknown'})`,
        combinedSignal,
      )

      if (!response.ok) {
        throw new TransportError(
          `HTTP POST failed: ${response.status} ${response.statusText}`,
          'HTTP_ERROR',
          true,
        )
      }

      const text = await response.text()
      if (text) {
        try {
          const parsed = JSON.parse(text)
          this._emit('message', parsed)
        } catch {
          this._emit('message', text)
        }
      }
    } catch (error: unknown) {
      if (error instanceof TransportError) throw error
      throw new TransportError(
        `Send failed: ${error instanceof Error ? error.message : String(error)}`,
        'SEND_ERROR',
        true,
      )
    }
  }

  async disconnect(): Promise<void> {
    if (this._state === 'disconnected') return

    this._setState('disconnecting')
    this._abortController?.abort()
    this._abortController = null
    this._options = null
    this._setState('disconnected')
    this._emit('close')
  }

  on(event: TransportEvent['type'], callback: (data?: any) => void): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, [])
    }
    this._listeners.get(event)!.push(callback)
    return () => {
      const handlers = this._listeners.get(event)
      if (handlers) {
        const idx = handlers.indexOf(callback)
        if (idx >= 0) handlers.splice(idx, 1)
      }
    }
  }

  getState(): TransportState {
    return this._state
  }
}

// ============================================================================
// TransportFactory
// Creates transport instances from MCP server configuration.
// ============================================================================

export class TransportFactory {
  static create(config: McpServerConfigUnion, options?: { timeout?: number }): Transport {
    switch (config.transport) {
      case 'stdio':
        return new StdioTransport(config, options)
      case 'sse':
        return new SSETransport(config, options)
      case 'http':
        return new HttpTransport(config, options)
      case 'ws':
        throw new TransportError('WebSocket transport not implemented', 'NOT_IMPLEMENTED', false)
      case 'sdk':
        throw new TransportError(
          'SDK transport requires @modelcontextprotocol/sdk',
          'NOT_IMPLEMENTED',
          false,
        )
    }
  }

  static getAvailableTransports(): TransportType[] {
    return ['stdio', 'sse', 'http', 'ws']
  }
}

// ============================================================================
// ConnectionPool
// Manages multiple transport connections indexed by server name.
// ============================================================================

export class ConnectionPool {
  connections: Map<string, Transport> = new Map()
  private _stateListeners: Map<string, Array<(state: TransportState) => void>> = new Map()
  private _cleanups: Map<string, () => void> = new Map()

  async connect(serverName: string, config: McpServerConfigUnion): Promise<Transport> {
    const existing = this.connections.get(serverName)
    if (existing) {
      await existing.disconnect()
      this.connections.delete(serverName)
    }

    const transport = TransportFactory.create(config)
    this.connections.set(serverName, transport)

    // Wire state tracking
    this._cleanups.get(serverName)?.()
    const cleanup = this._trackState(serverName, transport)
    this._cleanups.set(serverName, cleanup)

    await transport.connect({ serverName })

    return transport
  }

  private _trackState(serverName: string, transport: Transport): () => void {
    const notify = (): void => {
      const state = transport.getState()
      const handlers = this._stateListeners.get(serverName)
      if (handlers) {
        for (const h of handlers) h(state)
      }
    }

    const unsubs = [
      transport.on('open', notify),
      transport.on('error', notify),
      transport.on('close', notify),
    ]

    return () => {
      for (const u of unsubs) u()
    }
  }

  async disconnect(serverName: string): Promise<void> {
    const transport = this.connections.get(serverName)
    if (transport) {
      await transport.disconnect()
      this.connections.delete(serverName)
    }
    this._cleanups.get(serverName)?.()
    this._cleanups.delete(serverName)
  }

  async disconnectAll(): Promise<void> {
    const names = Array.from(this.connections.keys())
    await Promise.all(names.map((n) => this.disconnect(n)))
  }

  get(serverName: string): Transport | undefined {
    return this.connections.get(serverName)
  }

  async broadcast(message: unknown): Promise<void> {
    await Promise.all(
      Array.from(this.connections.values()).map((t) =>
        t.send(message).catch(() => {
          // Individual send errors are swallowed at broadcast level
        }),
      ),
    )
  }

  onStateChange(serverName: string, callback: (state: TransportState) => void): () => void {
    if (!this._stateListeners.has(serverName)) {
      this._stateListeners.set(serverName, [])
    }
    this._stateListeners.get(serverName)!.push(callback)
    return () => {
      const handlers = this._stateListeners.get(serverName)
      if (handlers) {
        const idx = handlers.indexOf(callback)
        if (idx >= 0) handlers.splice(idx, 1)
      }
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalConnectionPool: ConnectionPool | null = null

export function getConnectionPool(): ConnectionPool {
  if (!globalConnectionPool) {
    globalConnectionPool = new ConnectionPool()
  }
  return globalConnectionPool
}

export function resetConnectionPool(): void {
  globalConnectionPool = null
}
