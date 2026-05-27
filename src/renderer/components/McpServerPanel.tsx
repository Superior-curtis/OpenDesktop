import { useState, useEffect, useCallback } from 'react'
import { useChatStore } from '../store/chatStore'
import { getMcpService, type McpServerStatus, type ConnectedMcpServer, type McpConnectionState, type ScopedMcpServerConfig, type McpStdioConfig, type McpSSEConfig } from '../services/MCPClient'
import { Plug, Plus, Trash2, Play, Square, CheckCircle, XCircle, Clock, AlertTriangle, Loader2, Search, BookOpen, Server, Wrench, FileText } from 'lucide-react'

const STATUS_ICONS: Record<McpConnectionState, React.ComponentType<{ className?: string }>> = {
  connected: CheckCircle,
  connecting: Loader2,
  disconnected: Clock,
  failed: XCircle,
  'needs-auth': AlertTriangle,
  pending: Clock,
  disabled: XCircle,
}

const STATUS_COLORS: Record<McpConnectionState, string> = {
  connected: 'text-emerald-400',
  connecting: 'text-amber-400',
  disconnected: 'text-zinc-500',
  failed: 'text-red-400',
  'needs-auth': 'text-amber-400',
  pending: 'text-zinc-500',
  disabled: 'text-zinc-600',
}

export function McpServerPanel() {
  const { settings, addMCPServer, removeMCPServer } = useChatStore()
  const [servers, setServers] = useState<McpServerStatus[]>([])
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [newServer, setNewServer] = useState({ name: '', command: '', args: '', transport: 'stdio' as const })

  useEffect(() => {
    try {
      const service = getMcpService()
      setServers(service.getAllServers())
    } catch { /* mcp service not ready */ }
  }, [])

  const refreshServers = useCallback(() => {
    try {
      const service = getMcpService()
      setServers(service.getAllServers())
    } catch { /* ignore */ }
  }, [])

  const handleConnect = useCallback(async (name: string) => {
    setConnecting(name)
    try {
      const service = getMcpService()
      const config = (service as any).serverConfigs?.get?.(name) as ScopedMcpServerConfig | undefined
      if (config) {
        const result = await (service as any).connect?.(name, config)
        if (result && typeof result.then === 'function') await result
      }
      refreshServers()
    } catch { /* ignore */ }
    setConnecting(null)
  }, [refreshServers])

  const handleDisconnect = useCallback((name: string) => {
    try {
      (getMcpService() as any).disconnectServer?.(name)
      refreshServers()
    } catch { /* ignore */ }
  }, [refreshServers])

  const handleRemove = useCallback((name: string) => {
    try {
      getMcpService().removeServer(name)
      removeMCPServer(name)
      refreshServers()
    } catch { /* ignore */ }
  }, [removeMCPServer, refreshServers])

  const handleAdd = useCallback(() => {
    if (!newServer.name.trim() || !newServer.command.trim()) return
    const serverId = crypto.randomUUID()
    addMCPServer({
      id: serverId,
      name: newServer.name,
      command: newServer.command,
      args: newServer.args,
      enabled: true,
    })
    try {
      const service = getMcpService()
      service.addServer(newServer.name, {
        config: { transport: 'stdio' as const, command: newServer.command, args: newServer.args.split(' ').filter(Boolean) },
        scope: 'user',
      })
    } catch { /* ignore */ }
    setNewServer({ name: '', command: '', args: '', transport: 'stdio' })
    setShowAddForm(false)
    refreshServers()
  }, [newServer, addMCPServer, refreshServers])

  const filtered = search
    ? servers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.type.toLowerCase().includes(search.toLowerCase()))
    : servers

  const serverStatus = (name: string): McpConnectionState => {
    try { return getMcpService().getServerStatus(name) } catch { return 'disconnected' }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
        <Plug className="w-4 h-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-100">MCP Servers</h2>
        <span className="text-[10px] text-zinc-500 ml-auto">
          {servers.filter(s => serverStatus(s.name) === 'connected').length}/{servers.length} connected
        </span>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
        <Search className="w-3.5 h-3.5 text-zinc-500" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search servers..."
          className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
        />
      </div>

      {showAddForm && (
        <div className="mx-3 mt-3 p-3 rounded-lg bg-zinc-800 border border-zinc-700 space-y-2">
          <input
            type="text" value={newServer.name} onChange={(e) => setNewServer(s => ({ ...s, name: e.target.value }))}
            placeholder="Server name"
            className="w-full px-2.5 py-1.5 rounded bg-zinc-700 border border-zinc-600 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="text" value={newServer.command} onChange={(e) => setNewServer(s => ({ ...s, command: e.target.value }))}
            placeholder="Command (e.g. npx @modelcontextprotocol/server-filesystem)"
            className="w-full px-2.5 py-1.5 rounded bg-zinc-700 border border-zinc-600 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="text" value={newServer.args} onChange={(e) => setNewServer(s => ({ ...s, args: e.target.value }))}
            placeholder="Arguments (space separated)"
            className="w-full px-2.5 py-1.5 rounded bg-zinc-700 border border-zinc-600 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} disabled={!newServer.name || !newServer.command} className="flex-1 py-1.5 rounded bg-zinc-100 text-zinc-900 text-xs hover:bg-white disabled:opacity-40 transition-colors">
              Add Server
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 rounded bg-zinc-700 text-zinc-300 text-xs hover:bg-zinc-600 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {servers.length === 0 && !showAddForm ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600">
            <Server className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm text-zinc-500 mb-1">No MCP servers configured</p>
            <p className="text-xs text-zinc-600">Click Add to connect a server</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-zinc-600">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No servers match your search</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((server) => {
              const status = serverStatus(server.name)
              const StatusIcon = STATUS_ICONS[status]
              const statusColor = STATUS_COLORS[status]
              const isExpanded = expanded === server.name
              const isConnected = status === 'connected'

              return (
                <div
                  key={server.name}
                  className="rounded-lg bg-zinc-800/40 border border-zinc-800 overflow-hidden"
                >
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-zinc-800/60 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : server.name)}
                  >
                    <StatusIcon className={`w-3.5 h-3.5 ${statusColor} ${status === 'connecting' ? 'animate-spin' : ''}`} />
                    <span className="text-sm text-zinc-200 flex-1">{server.name}</span>
                    <span className={`text-[10px] font-medium ${statusColor}`}>{status}</span>

                    <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                      {isConnected ? (
                        <button onClick={() => handleDisconnect(server.name)} className="p-1 hover:bg-zinc-700 rounded" title="Disconnect">
                          <Square className="w-3 h-3 text-zinc-500" />
                        </button>
                      ) : (
                        <button onClick={() => handleConnect(server.name)} disabled={connecting === server.name} className="p-1 hover:bg-zinc-700 rounded disabled:opacity-50" title="Connect">
                          {connecting === server.name
                            ? <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                            : <Play className="w-3 h-3 text-zinc-500" />
                          }
                        </button>
                      )}
                      <button onClick={() => handleRemove(server.name)} className="p-1 hover:bg-zinc-700 rounded" title="Remove">
                        <Trash2 className="w-3 h-3 text-zinc-500" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && 'config' in server && (
                    <div className="px-3 pb-3 pt-0 border-t border-zinc-800/50 mt-0">
                      <div className="pt-2 space-y-1.5 text-[10px] text-zinc-500">
                        <div>Transport: <span className="text-zinc-400 font-mono">{server.config.config.transport}</span></div>
                        {'command' in server.config.config && (
                          <div>Command: <span className="text-zinc-400 font-mono">{(server.config.config as McpStdioConfig).command}</span></div>
                        )}
                        {'url' in server.config.config && (
                          <div>URL: <span className="text-zinc-400 font-mono">{(server.config.config as McpSSEConfig).url}</span></div>
                        )}
                        {'args' in server.config.config && (server.config.config as McpStdioConfig).args.length > 0 && (
                          <div>Args: <span className="text-zinc-400 font-mono">{(server.config.config as McpStdioConfig).args.join(' ')}</span></div>
                        )}

                        {isConnected && (server as ConnectedMcpServer).tools && (
                          <div className="mt-2">
                            <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                              <Wrench className="w-3 h-3" />
                              <span>Tools ({(server as ConnectedMcpServer).tools.length})</span>
                            </div>
                            {(server as ConnectedMcpServer).tools.slice(0, 5).map(tool => (
                              <div key={tool.name} className="px-2 py-1 rounded bg-zinc-800/50 mb-0.5">
                                <div className="text-zinc-300">{tool.name}</div>
                                {tool.description && <div className="text-zinc-600">{tool.description}</div>}
                              </div>
                            ))}
                            {(server as ConnectedMcpServer).tools.length > 5 && (
                              <div className="text-zinc-600 text-[10px] px-1">+{(server as ConnectedMcpServer).tools.length - 5} more</div>
                            )}
                          </div>
                        )}

                        {isConnected && (server as ConnectedMcpServer).resources && (server as ConnectedMcpServer).resources.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                              <FileText className="w-3 h-3" />
                              <span>Resources ({(server as ConnectedMcpServer).resources.length})</span>
                            </div>
                            {(server as ConnectedMcpServer).resources.slice(0, 3).map(res => (
                              <div key={res.uri} className="text-zinc-500 font-mono text-[10px] truncate">{res.uri}</div>
                            ))}
                          </div>
                        )}

                        {server.type === 'failed' && 'error' in server && (
                          <div className="mt-1 px-2 py-1 rounded bg-red-900/20 text-red-400">{server.error}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Config from settings */}
        {settings.mcpServers.length > 0 && (
          <div className="mt-4 pt-3 border-t border-zinc-800">
            <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">From Settings</h3>
            <div className="space-y-1">
              {settings.mcpServers.map(s => {
                const exists = servers.find(serv => serv.name === s.name)
                if (exists) return null
                return (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded bg-zinc-800/30 text-xs">
                    <div>
                      <span className="text-zinc-300">{s.name}</span>
                      <span className="text-zinc-600 ml-2 font-mono text-[10px]">{s.command}</span>
                    </div>
                    <button
                      onClick={() => {
                        try {
                          const service = getMcpService()
                          service.addServer(s.name, {
                            config: { transport: 'stdio', command: s.command, args: s.args.split(' ').filter(Boolean) },
                            scope: 'user',
                          })
                          refreshServers()
                        } catch { /* ignore */ }
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 text-[10px]"
                    >
                      Activate
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
