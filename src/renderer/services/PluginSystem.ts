// ============================================================================
// Plugin System (based on Claude Code's plugin architecture)
// Manifest-based, lifecycle management, hooks, skills, MCP, LSP
// ============================================================================

export interface PluginAuthor {
  name: string
  email?: string
  url?: string
}

export interface PluginManifest {
  name: string
  version: string
  description: string
  author?: PluginAuthor
  repository?: string
  license?: string
  commands?: string | string[]
  agents?: string | string[]
  skills?: string | string[]
  'output-styles'?: string | string[]
  hooks?: HooksConfig
  mcpServers?: Record<string, any>
  lspServers?: Record<string, any>
  settings?: Record<string, unknown>
}

export interface HooksConfig {
  beforeReadFile?: string[]
  afterReadFile?: string[]
  beforeWriteFile?: string[]
  afterWriteFile?: string[]
  beforeExecuteCommand?: string[]
  afterExecuteCommand?: string[]
  fileChanged?: string[]
  beforeQuery?: string[]
  afterQuery?: string[]
}

export interface PluginDefinition {
  name: string
  description: string
  version?: string
  skills?: string[]
  hooks?: HooksConfig
  mcpServers?: Record<string, any>
  isAvailable?: () => boolean
  defaultEnabled?: boolean
}

export type PluginSource = 'builtin' | 'project' | 'user' | 'marketplace'

export interface LoadedPlugin {
  name: string
  manifest?: PluginManifest
  source: PluginSource
  enabled: boolean
  isBuiltin: boolean
  skills: string[]
  hooks: HooksConfig
  mcpServers: Record<string, any>
  settings?: Record<string, unknown>
  loadedAt: number
  error?: string
}

export type PluginEventType =
  | 'before_query'
  | 'after_query'
  | 'before_read_file'
  | 'after_read_file'
  | 'before_write_file'
  | 'after_write_file'
  | 'before_command'
  | 'after_command'
  | 'file_changed'
  | 'post_compact_cleanup'

export interface PluginEvent {
  type: PluginEventType
  pluginName: string
  data: any
  timestamp: number
}

// ============================================================================
// Built-in plugin definitions
// ============================================================================

const BUILTIN_PLUGINS: PluginDefinition[] = [
  {
    name: 'core-tools',
    description: 'Core built-in tools (Read, Write, Edit, Bash, Glob, Grep)',
    defaultEnabled: true,
    skills: ['file-operations', 'search', 'shell'],
  },
  {
    name: 'web-tools',
    description: 'Web search and fetch capabilities',
    defaultEnabled: true,
    skills: ['web-search', 'web-fetch'],
  },
  {
    name: 'skill-manager',
    description: 'AI skill management system',
    defaultEnabled: true,
    hooks: {
      beforeQuery: ['inject-relevant-skills'],
    },
  },
]

// ============================================================================
// Plugin Manager
// ============================================================================

export class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map()
  private eventListeners: Map<PluginEventType, Set<(event: PluginEvent) => void>> = new Map()
  private skillRegistrations: Map<string, string[]> = new Map()

  constructor() {
    this.loadBuiltinPlugins()
  }

  private loadBuiltinPlugins(): void {
    for (const def of BUILTIN_PLUGINS) {
      this.registerBuiltin(def)
    }
  }

  private registerBuiltin(def: PluginDefinition): void {
    const plugin: LoadedPlugin = {
      name: def.name,
      source: 'builtin',
      enabled: def.defaultEnabled !== false,
      isBuiltin: true,
      skills: def.skills ?? [],
      hooks: def.hooks ?? {},
      mcpServers: def.mcpServers ?? {},
      loadedAt: Date.now(),
    }

    if (def.isAvailable && !def.isAvailable()) {
      plugin.enabled = false
      plugin.error = 'Plugin not available on this platform'
    }

    this.plugins.set(def.name, plugin)
    this.registerPluginSkills(def.name, plugin.skills)
  }

  private registerPluginSkills(pluginName: string, skills: string[]): void {
    this.skillRegistrations.set(pluginName, skills)
  }

  // Install a plugin from a manifest
  async install(
    manifest: PluginManifest,
    source: PluginSource = 'project',
  ): Promise<LoadedPlugin> {
    const existing = this.plugins.get(manifest.name)
    if (existing && existing.source === 'builtin') {
      throw new Error(`Cannot override built-in plugin: ${manifest.name}`)
    }

    const plugin: LoadedPlugin = {
      name: manifest.name,
      manifest,
      source,
      enabled: true,
      isBuiltin: false,
      skills: this.resolveManifestField(manifest.skills),
      hooks: manifest.hooks ?? {},
      mcpServers: manifest.mcpServers ?? {},
      settings: manifest.settings,
      loadedAt: Date.now(),
    }

    this.plugins.set(manifest.name, plugin)
    this.registerPluginSkills(manifest.name, plugin.skills)
    this.persistPlugins()
    return plugin
  }

  private resolveManifestField(field: string | string[] | undefined): string[] {
    if (!field) return []
    return Array.isArray(field) ? field : [field]
  }

  remove(name: string): boolean {
    const plugin = this.plugins.get(name)
    if (!plugin || plugin.isBuiltin) return false
    this.plugins.delete(name)
    this.skillRegistrations.delete(name)
    this.persistPlugins()
    return true
  }

  enable(name: string): void {
    const plugin = this.plugins.get(name)
    if (plugin) {
      plugin.enabled = true
      this.persistPlugins()
    }
  }

  disable(name: string): void {
    const plugin = this.plugins.get(name)
    if (plugin && !plugin.isBuiltin) {
      plugin.enabled = false
      this.persistPlugins()
    }
  }

  get(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name)
  }

  list(): LoadedPlugin[] {
    return Array.from(this.plugins.values())
  }

  getEnabled(): LoadedPlugin[] {
    return this.list().filter((p) => p.enabled)
  }

  getSkillsForPlugin(pluginName: string): string[] {
    return this.skillRegistrations.get(pluginName) ?? []
  }

  getAllRegisteredSkills(): string[] {
    const all: string[] = []
    for (const plugin of this.getEnabled()) {
      all.push(...plugin.skills)
    }
    return all
  }

  // Hook system
  on(eventType: PluginEventType, listener: (event: PluginEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set())
    }
    this.eventListeners.get(eventType)!.add(listener)
    return () => this.eventListeners.get(eventType)?.delete(listener)
  }

  async emit(eventType: PluginEventType, data: any): Promise<void> {
    const listeners = this.eventListeners.get(eventType)
    if (!listeners) return

    const events: PluginEvent[] = []
    for (const plugin of this.getEnabled()) {
      const hooks = plugin.hooks as Record<string, any>
      const hook = hooks[eventType]
      if (hook) {
        events.push({
          type: eventType,
          pluginName: plugin.name,
          data,
          timestamp: Date.now(),
        })
      }
    }

    for (const event of events) {
      for (const listener of listeners) {
        try { listener(event) } catch { /* ignore hook errors */ }
      }
    }
  }

  // Persistence
  private PERSIST_KEY = 'opencode_plugins'

  private persistPlugins(): void {
    try {
      const state = this.list()
        .filter((p) => !p.isBuiltin)
        .map((p) => ({
          name: p.name,
          source: p.source,
          enabled: p.enabled,
          manifest: p.manifest,
        }))
      localStorage.setItem(this.PERSIST_KEY, JSON.stringify(state))
    } catch { /* ignore storage errors */ }
  }

  async loadPersisted(): Promise<void> {
    try {
      const raw = localStorage.getItem(this.PERSIST_KEY)
      if (!raw) return
      const state: Array<{ name: string; source: PluginSource; enabled: boolean; manifest?: PluginManifest }> = JSON.parse(raw)
      for (const entry of state) {
        if (entry.manifest) {
          const plugin = await this.install(entry.manifest, entry.source)
          if (!entry.enabled) plugin.enabled = false
        }
      }
    } catch { /* ignore parse errors */ }
  }

  // Get hooks config for system prompt injection
  getHooksForPrompt(): string {
    const hooks = this.getEnabled()
      .filter((p) => Object.keys(p.hooks).length > 0)
      .map((p) => `- ${p.name}: ${Object.keys(p.hooks).join(', ')}`)
    if (hooks.length === 0) return ''
    return `Active plugin hooks:\n${hooks.join('\n')}`
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalPluginManager: PluginManager | null = null

export function getPluginManager(): PluginManager {
  if (!globalPluginManager) {
    globalPluginManager = new PluginManager()
    globalPluginManager.loadPersisted()
  }
  return globalPluginManager
}

export function resetPluginManager(): void {
  globalPluginManager = null
}
