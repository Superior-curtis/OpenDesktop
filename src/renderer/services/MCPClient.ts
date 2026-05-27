// ============================================================================
// MCP Types (based on Claude Code source: src/services/mcp/types.ts)
// ============================================================================

export type ConfigScope = 'local' | 'user' | 'project' | 'dynamic' | 'enterprise' | 'claudeai' | 'managed'
export type TransportType = 'stdio' | 'sse' | 'http' | 'ws' | 'sdk'

export interface McpStdioConfig {
  command: string
  args: string[]
  env?: Record<string, string>
}

export interface McpSSEConfig {
  url: string
  headers?: Record<string, string>
}

export interface McpHttpConfig {
  url: string
  headers?: Record<string, string>
}

export interface McpWebSocketConfig {
  url: string
  headers?: Record<string, string>
}

export interface McpSdkConfig {
  name: string
}

export type McpServerConfigUnion =
  | ({ transport: 'stdio' } & McpStdioConfig)
  | ({ transport: 'sse' } & McpSSEConfig)
  | ({ transport: 'http' } & McpHttpConfig)
  | ({ transport: 'ws' } & McpWebSocketConfig)
  | ({ transport: 'sdk' } & McpSdkConfig)

export interface ScopedMcpServerConfig {
  config: McpServerConfigUnion
  scope: ConfigScope
  pluginSource?: string
}

export interface McpServerDefinition {
  name: string
  config: ScopedMcpServerConfig
}

export type McpConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled'

export interface ConnectedMcpServer {
  name: string
  type: 'connected'
  capabilities: string[]
  tools: McpToolDef[]
  resources: McpResourceDef[]
  prompts: McpPromptDef[]
  instructions?: string
  config: ScopedMcpServerConfig
}

export interface FailedMcpServer {
  name: string
  type: 'failed'
  config: ScopedMcpServerConfig
  error?: string
}

export interface NeedsAuthMcpServer {
  name: string
  type: 'needs-auth'
  config: ScopedMcpServerConfig
}

export interface PendingMcpServer {
  name: string
  type: 'pending'
  config: ScopedMcpServerConfig
}

export type McpServerStatus = ConnectedMcpServer | FailedMcpServer | NeedsAuthMcpServer | PendingMcpServer

export interface McpToolDef {
  name: string
  description?: string
  inputSchema?: Record<string, any>
  serverName: string
}

export interface McpResourceDef {
  uri: string
  name: string
  description?: string
  serverName: string
  mimeType?: string
}

export interface McpPromptDef {
  name: string
  description?: string
  arguments?: Array<{ name: string; description?: string; required?: boolean }>
  serverName: string
}

export interface McpToolCallResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>
  isError: boolean
}

import { getConnectionPool } from './MCPTransport'

// ============================================================================
// MCP State Management
// ============================================================================

export type McpStateListener =
  | { type: 'status'; fn: (server: string, status: McpConnectionState) => void }
  | { type: 'tools'; fn: (tools: McpToolDef[]) => void }
  | { type: 'resources'; fn: (resources: McpResourceDef[]) => void }
  | { type: 'error'; fn: (server: string, error: string) => void }

// ============================================================================
// MCP Client Service
// ============================================================================

export class McpClientService {
  private servers: Map<string, McpServerStatus> = new Map()
  private serverConfigs: Map<string, ScopedMcpServerConfig> = new Map()
  private listeners: McpStateListener[] = []
  private toolCache: McpToolDef[] = []
  private resourceCache: McpResourceDef[] = []

  constructor(config?: Partial<{ servers: McpServerDefinition[] }>) {
    if (config?.servers) {
      for (const def of config.servers) {
        this.serverConfigs.set(def.name, def.config)
        this.servers.set(def.name, { name: def.name, type: 'pending', config: def.config })
      }
    }
  }

  on(listener: McpStateListener): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx >= 0) this.listeners.splice(idx, 1)
    }
  }

  private emitStatus(server: string, status: McpConnectionState): void {
    for (const l of this.listeners) {
      if (l.type === 'status') l.fn(server, status)
    }
  }

  private emitTools(): void {
    for (const l of this.listeners) {
      if (l.type === 'tools') l.fn(this.toolCache)
    }
  }

  private emitResources(): void {
    for (const l of this.listeners) {
      if (l.type === 'resources') l.fn(this.resourceCache)
    }
  }

  private emitError(server: string, error: string): void {
    for (const l of this.listeners) {
      if (l.type === 'error') l.fn(server, error)
    }
  }

  getServerNames(): string[] {
    return Array.from(this.servers.keys())
  }

  getServer(name: string): McpServerStatus | undefined {
    return this.servers.get(name)
  }

  getServerStatus(name: string): McpConnectionState {
    const server = this.servers.get(name)
    if (!server) return 'disconnected'
    if (server.type === 'connected') return 'connected'
    if (server.type === 'failed') return 'failed'
    if (server.type === 'needs-auth') return 'needs-auth'
    return 'pending'
  }

  getAllServers(): McpServerStatus[] {
    return Array.from(this.servers.values())
  }

  getConnectedServers(): ConnectedMcpServer[] {
    return this.getAllServers().filter((s): s is ConnectedMcpServer => s.type === 'connected')
  }

  getTools(): McpToolDef[] {
    return [...this.toolCache]
  }

  getResources(): McpResourceDef[] {
    return [...this.resourceCache]
  }

  getTool(serverName: string, toolName: string): McpToolDef | undefined {
    return this.toolCache.find(t => t.serverName === serverName && t.name === toolName)
  }

  addServer(name: string, config: ScopedMcpServerConfig): void {
    this.serverConfigs.set(name, config)
    this.servers.set(name, { name, type: 'pending', config })
  }

  removeServer(name: string): void {
    this.servers.delete(name)
    this.serverConfigs.delete(name)
    this.toolCache = this.toolCache.filter(t => t.serverName !== name)
    this.resourceCache = this.resourceCache.filter(r => r.serverName !== name)
    this.emitTools()
    this.emitResources()
  }

  async connectAll(): Promise<void> {
    for (const [name, config] of this.serverConfigs) {
      await this.connect(name, config)
    }
  }

  async connect(name: string, config?: ScopedMcpServerConfig): Promise<void> {
    const cfg = config ?? this.serverConfigs.get(name)
    if (!cfg) return

    this.emitStatus(name, 'connecting')
    this.servers.set(name, { name, type: 'pending', config: cfg })

    try {
      let tools: McpToolDef[] = []
      let resources: McpResourceDef[] = []
      let prompts: McpPromptDef[] = []
      const transport = cfg.config.transport

      if (transport === 'stdio') {
        const result = await this.connectStdio(name, cfg)
        tools = result.tools
        resources = result.resources
        prompts = result.prompts
      } else if (transport === 'sse' || transport === 'http') {
        const result = await this.connectHttp(name, cfg)
        tools = result.tools
        resources = result.resources
        prompts = result.prompts
      }

      const connected: ConnectedMcpServer = {
        name,
        type: 'connected',
        capabilities: ['tools', ...(resources.length > 0 ? ['resources'] : []), ...(prompts.length > 0 ? ['prompts'] : [])],
        tools,
        resources,
        prompts,
        config: cfg,
      }

      this.servers.set(name, connected)
      this.toolCache.push(...tools)
      this.resourceCache.push(...resources)
      this.emitStatus(name, 'connected')
      this.emitTools()
      this.emitResources()
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      this.servers.set(name, { name, type: 'failed', config: cfg, error: errMsg })
      this.emitStatus(name, 'failed')
      this.emitError(name, errMsg)
    }
  }

  async disconnect(name: string): Promise<void> {
    const server = this.servers.get(name)
    if (server && server.type === 'connected') {
      this.toolCache = this.toolCache.filter(t => t.serverName !== name)
      this.resourceCache = this.resourceCache.filter(r => r.serverName !== name)
      this.emitTools()
      this.emitResources()
    }
    this.servers.delete(name)
    this.emitStatus(name, 'disconnected')
  }

  async disconnectAll(): Promise<void> {
    for (const name of this.getServerNames()) {
      await this.disconnect(name)
    }
  }

  async callTool(serverName: string, toolName: string, args: Record<string, any>): Promise<McpToolCallResult> {
    const server = this.servers.get(serverName)
    if (!server || server.type !== 'connected') {
      return {
        content: [{ type: 'text', text: `Server "${serverName}" is not connected` }],
        isError: true,
      }
    }

    try {
      const result = await this.executeMcpTool(serverName, toolName, args)
      return result
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error calling tool ${toolName} on ${serverName}: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true,
      }
    }
  }

  async readResource(serverName: string, uri: string): Promise<string | null> {
    const server = this.servers.get(serverName)
    if (!server || server.type !== 'connected') return null

    try {
      return await this.executeMcpReadResource(serverName, uri)
    } catch {
      return null
    }
  }

  // Transport implementations via MCPTransport layer
  private async connectStdio(name: string, config: ScopedMcpServerConfig): Promise<{
    tools: McpToolDef[]
    resources: McpResourceDef[]
    prompts: McpPromptDef[]
  }> {
    const pool = getConnectionPool()
    const transport = await pool.connect(name, config.config)
    return this.initializeWithTransport(name, transport)
  }

  private async connectHttp(name: string, config: ScopedMcpServerConfig): Promise<{
    tools: McpToolDef[]
    resources: McpResourceDef[]
    prompts: McpPromptDef[]
  }> {
    const pool = getConnectionPool()
    const transport = await pool.connect(name, config.config)
    return this.initializeWithTransport(name, transport)
  }

  private async initializeWithTransport(name: string, transport: any): Promise<{
    tools: McpToolDef[]
    resources: McpResourceDef[]
    prompts: McpPromptDef[]
  }> {
    const sendRpc = async (method: string, params: any): Promise<any> => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const request = { jsonrpc: '2.0', id, method, params }
      return new Promise((resolve, reject) => {
        const unsub = transport.on('message', (data: any) => {
          if (data?.id === id) { unsub(); data.error ? reject(new Error(data.error.message)) : resolve(data.result) }
        })
        transport.send(request).catch((err: any) => { unsub(); reject(err) })
      })
    }

    await sendRpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'opencode', version: '1.0.0' } }).catch(() => {})

    const [toolsResult, resourcesResult, promptsResult] = await Promise.all([
      sendRpc('tools/list', {}).catch(() => null),
      sendRpc('resources/list', {}).catch(() => null),
      sendRpc('prompts/list', {}).catch(() => null),
    ])

    const tools: McpToolDef[] = (toolsResult?.tools ?? []).map((t: any) => ({
      name: t.name, description: t.description, inputSchema: t.inputSchema, serverName: name,
    }))
    const resources: McpResourceDef[] = (resourcesResult?.resources ?? []).map((r: any) => ({
      uri: r.uri, name: r.name, description: r.description, serverName: name, mimeType: r.mimeType,
    }))
    const prompts: McpPromptDef[] = (promptsResult?.prompts ?? []).map((p: any) => ({
      name: p.name, description: p.description, arguments: p.arguments, serverName: name,
    }))

    return { tools, resources, prompts }
  }

  private async executeMcpTool(serverName: string, toolName: string, args: Record<string, any>): Promise<McpToolCallResult> {
    const pool = getConnectionPool()
    const transport = pool.get(serverName)
    if (!transport) {
      return { content: [{ type: 'text', text: `Server "${serverName}" not connected` }], isError: true }
    }
    try {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const result = await new Promise<any>((resolve, reject) => {
        const unsub = transport.on('message', (data: any) => {
          if (data?.id === id) { unsub(); data.error ? reject(new Error(data.error.message)) : resolve(data.result) }
        })
        transport.send({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: toolName, arguments: args } }).catch((err: any) => { unsub(); reject(err) })
      })
      return { content: result?.content ?? [{ type: 'text', text: 'No content' }], isError: result?.isError ?? false }
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown'}` }], isError: true }
    }
  }

  private async executeMcpReadResource(serverName: string, uri: string): Promise<string> {
    const pool = getConnectionPool()
    const transport = pool.get(serverName)
    if (!transport) throw new Error(`Server "${serverName}" not connected`)
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const result = await new Promise<any>((resolve, reject) => {
      const unsub = transport.on('message', (data: any) => {
        if (data?.id === id) { unsub(); data.error ? reject(new Error(data.error.message)) : resolve(data.result) }
      })
      transport.send({ jsonrpc: '2.0', id, method: 'resources/read', params: { uri } }).catch((err: any) => { unsub(); reject(err) })
    })
    const content = result?.contents?.[0]
    return content?.text ?? content?.data ?? ''
  }

  static parseJsonConfig(json: string, scope: ConfigScope): McpServerDefinition[] {
    try {
      const parsed = JSON.parse(json)
      const servers = parsed.mcpServers ?? parsed
      if (typeof servers !== 'object') return []

      return Object.entries(servers)
        .filter(([_, cfg]) => cfg && typeof cfg === 'object')
        .map(([name, cfg]) => {
          const config = cfg as Record<string, any>
          let transport: McpServerConfigUnion

          if (config.command) {
            transport = { transport: 'stdio', command: config.command, args: config.args ?? [], env: config.env }
          } else if (config.url) {
            const urlStr = String(config.url)
            if (urlStr.startsWith('http')) {
              transport = { transport: 'sse', url: urlStr, headers: config.headers }
            } else if (urlStr.startsWith('ws')) {
              transport = { transport: 'ws', url: urlStr, headers: config.headers }
            } else {
              transport = { transport: 'stdio', command: urlStr, args: [] }
            }
          } else {
            transport = { transport: 'stdio', command: '', args: [] }
          }

          const fullConfig: ScopedMcpServerConfig = { config: transport, scope }
          return { name: String(name), config: fullConfig } as McpServerDefinition
        })
    } catch {
      return []
    }
  }
}

// ============================================================================
// Singleton factory
// ============================================================================

let globalMcpService: McpClientService | null = null

export function getMcpService(config?: Partial<{ servers: McpServerDefinition[] }>): McpClientService {
  if (!globalMcpService) {
    globalMcpService = new McpClientService(config)
  }
  return globalMcpService
}

export function resetMcpService(): void {
  globalMcpService = null
}

export function syncMcpConfigs(configs: { name: string; command: string; args: string; env?: Record<string, string>; enabled: boolean }[]): McpClientService {
  const service = getMcpService()
  for (const cfg of configs) {
    if (!cfg.enabled) continue
    if (!service.getServerStatus || service.getServerStatus(cfg.name) === 'disconnected') {
      service.addServer(cfg.name, {
        config: {
          transport: 'stdio',
          command: cfg.command,
          args: cfg.args.split(' ').filter(Boolean),
          ...(cfg.env ? { env: cfg.env } : {}),
        },
        scope: 'user',
      })
    }
  }
  return service
}
