// ============================================================================
// Config Resolver (based on OpenCode's layered config resolution system)
// Multi-layer config with priority merging, JSONC support, variable substitution
// ============================================================================

// ============================================================================
// 1. Config Scope Types
// ============================================================================

export type ConfigScope = 'default' | 'global' | 'project' | 'local' | 'env' | 'cli' | 'managed'

export const CONFIG_PRIORITY: Record<ConfigScope, number> = {
  managed: 6,
  cli: 5,
  env: 4,
  project: 3,
  local: 2,
  global: 1,
  default: 0,
}

export interface ConfigSource {
  scope: ConfigScope
  data: Record<string, any>
  path?: string
  timestamp: number
}

export interface AppConfig {
  shell?: { default?: string; deny?: string[] }
  model?: string
  smallModel?: string
  agent?: string
  permissions?: Record<string, string | Record<string, string>>
  providers?: Record<string, { apiKey?: string; baseUrl?: string; models?: string[] }>
  mcp?: Record<string, { command?: string; args?: string[]; url?: string; enabled?: boolean; env?: Record<string, string> }>
  skills?: { paths?: string[]; urls?: string[] }
  tools?: Record<string, boolean | { maxLines?: number; maxBytes?: number }>
  compaction?: { enabled?: boolean; maxConsecutiveFailures?: number; minTokensFreed?: number; warningThreshold?: number; reserveTokens?: number; tailTurns?: number }
  instructions?: string[]
  theme?: Record<string, any>
  experimental?: Record<string, boolean>
  [key: string]: any
}

// ============================================================================
// 2. Deep Merge Utility
// ============================================================================

function isPlainObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  const result: Record<string, any> = { ...target }

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue

    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue

      const existing = result[key]

      if (Array.isArray(value) && Array.isArray(existing)) {
        result[key] = [...existing, ...value]
      } else if (isPlainObject(value) && isPlainObject(existing)) {
        result[key] = deepMerge(existing, value)
      } else {
        result[key] = value
      }
    }
  }

  return result as T
}

// ============================================================================
// 3. Nested Key Helpers
// ============================================================================

function parseKey(key: string): string | number {
  return /^\d+$/.test(key) ? parseInt(key, 10) : key
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  const keys = path.split('.')
  let current: any = obj
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[parseKey(key)]
  }
  return current
}

function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.')
  let current: any = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const key = parseKey(keys[i])
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  current[parseKey(keys[keys.length - 1])] = value
}

const SCOPES_SORTED: ConfigScope[] = (Object.keys(CONFIG_PRIORITY) as ConfigScope[]).sort(
  (a, b) => CONFIG_PRIORITY[a] - CONFIG_PRIORITY[b],
)

// ============================================================================
// 4. Config Resolver
// ============================================================================

export class ConfigResolver {
  private sources: ConfigSource[] = []
  private merged: AppConfig | null = null
  private listeners: Set<(config: AppConfig) => void> = new Set()

  addSource(source: ConfigSource): void {
    const idx = this.sources.findIndex((s) => s.scope === source.scope)
    if (idx >= 0) {
      this.sources[idx] = source
    } else {
      this.sources.push(source)
    }
    this.merged = null
    this.notifyListeners()
  }

  removeSource(scope: ConfigScope): void {
    const before = this.sources.length
    this.sources = this.sources.filter((s) => s.scope !== scope)
    if (this.sources.length !== before) {
      this.merged = null
      this.notifyListeners()
    }
  }

  resolve(): AppConfig {
    if (this.merged) return this.merged

    const sorted = [...this.sources].sort(
      (a, b) => CONFIG_PRIORITY[a.scope] - CONFIG_PRIORITY[b.scope],
    )

    const base: Record<string, any> = {}
    for (const source of sorted) {
      deepMerge(base, source.data)
    }

    this.merged = base as AppConfig
    return this.merged
  }

  get<T = any>(path: string): T | undefined {
    return getNestedValue(this.resolve() as unknown as Record<string, any>, path) as T | undefined
  }

  set(path: string, value: any, scope: ConfigScope = 'local'): void {
    const existing = this.sources.find((s) => s.scope === scope)
    if (existing) {
      setNestedValue(existing.data, path, value)
      existing.timestamp = Date.now()
    } else {
      const data: Record<string, any> = {}
      setNestedValue(data, path, value)
      this.sources.push({ scope, data, timestamp: Date.now() })
    }
    this.merged = null
    this.notifyListeners()
  }

  onChange(callback: (config: AppConfig) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  reload(): AppConfig {
    this.merged = null
    return this.resolve()
  }

  getSources(): ConfigSource[] {
    return [...this.sources]
  }

  toPromptString(): string {
    this.resolve()
    const lines: string[] = ['<config>']
    for (const key of SCOPES_SORTED) {
      const scoped = this.sources.find((s) => s.scope === key)
      if (scoped && Object.keys(scoped.data).length > 0) {
        lines.push(`  [${key}]`)
        for (const [k, v] of Object.entries(scoped.data)) {
          lines.push(`    ${k}: ${formatConfigValue(v)}`)
        }
      }
    }
    lines.push('</config>')
    return lines.join('\n')
  }

  private notifyListeners(): void {
    const config = this.resolve()
    for (const cb of this.listeners) {
      cb(config)
    }
  }
}

function formatConfigValue(value: any): string {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (value === null) return 'null'
  if (Array.isArray(value)) return `[${value.join(', ')}]`
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

// ============================================================================
// 5. JSONC Parser
// ============================================================================

export function parseJsonc(text: string): any {
  const noComments = text
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const clean = noComments.replace(/,(\s*[}\]])/g, '$1')
  return JSON.parse(clean)
}

// ============================================================================
// 6. Variable Substitution
// ============================================================================

export function substituteVars(value: string, vars: Record<string, string>): string {
  return value.replace(/\{([^:}]+):([^}]+)\}/g, (_, type: string, name: string) => {
    if (type === 'env') {
      return vars[name] ?? process.env[name] ?? `{env:${name}}`
    }
    return value
  })
}

export function resolveEnvVars(value: string): string {
  return value.replace(/\{env:([^}]+)\}/g, (_, name: string) => {
    return process.env[name] ?? `{env:${name}}`
  })
}

// ============================================================================
// 7. Config File Discovery
// ============================================================================

export const CONFIG_FILE_NAMES = ['opencode.json', 'opencode.jsonc', 'config.json']

export async function findConfigFiles(dir: string): Promise<string[]> {
  const results: string[] = []
  for (const name of CONFIG_FILE_NAMES) {
    try {
      const files = await window.api.glob(`${dir}/**/${name}`)
      results.push(...files)
    } catch {
      continue
    }
  }
  return [...new Set(results)]
}

// ============================================================================
// 8. Config Loaders
// ============================================================================

export function loadDefaults(): ConfigSource {
  return {
    scope: 'default',
    data: {
      model: 'claude-sonnet-4-20250514',
      smallModel: 'claude-3-haiku',
      compaction: {
        enabled: true,
        maxConsecutiveFailures: 3,
        minTokensFreed: 1000,
        warningThreshold: 0.8,
        reserveTokens: 2000,
        tailTurns: 10,
      },
    },
    timestamp: Date.now(),
  }
}

export async function loadGlobalConfig(): Promise<ConfigSource> {
  try {
    const userDataPath = await window.electron.getUserDataPath()
    for (const name of CONFIG_FILE_NAMES) {
      try {
        const content = await window.api.readFile(`${userDataPath}/${name}`)
        const data = name.endsWith('.jsonc') ? parseJsonc(content) : JSON.parse(content)
        return { scope: 'global', data, path: `${userDataPath}/${name}`, timestamp: Date.now() }
      } catch {
        continue
      }
    }
  } catch {
    // Environment without Electron APIs
  }
  return { scope: 'global', data: {}, timestamp: Date.now() }
}

export async function loadProjectConfig(projectDir?: string): Promise<ConfigSource> {
  const dir = projectDir || (typeof window !== 'undefined' ? window.location.pathname : process.cwd())
  for (const name of CONFIG_FILE_NAMES) {
    try {
      const content = await window.api.readFile(`${dir}/${name}`)
      const data = name.endsWith('.jsonc') ? parseJsonc(content) : JSON.parse(content)
      return { scope: 'project', data, path: `${dir}/${name}`, timestamp: Date.now() }
    } catch {
      continue
    }
  }
  return { scope: 'project', data: {}, timestamp: Date.now() }
}

export function loadEnvConfig(): ConfigSource {
  const envConfig: Record<string, any> = {}
  const model = process.env.OPENCODE_MODEL
  const smallModel = process.env.OPENCODE_SMALL_MODEL
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY

  if (model) envConfig.model = model
  if (smallModel) envConfig.smallModel = smallModel
  if (apiKey && process.env.OPENCODE_PROVIDER) {
    envConfig.providers = {
      [process.env.OPENCODE_PROVIDER]: { apiKey },
    }
  }

  return { scope: 'env', data: envConfig, timestamp: Date.now() }
}

export function loadJsonConfig(json: string, scope: ConfigScope): ConfigSource {
  const data = JSON.parse(json)
  return { scope, data, timestamp: Date.now() }
}

// ============================================================================
// 9. Schema Validation
// ============================================================================

interface ValidationRule {
  path: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required?: boolean
  enum?: any[]
  min?: number
  max?: number
}

const VALIDATION_RULES: ValidationRule[] = [
  { path: 'model', type: 'string' },
  { path: 'smallModel', type: 'string' },
  { path: 'shell.default', type: 'string' },
  { path: 'shell.deny', type: 'array' },
  { path: 'instructions', type: 'array' },
  { path: 'compaction.enabled', type: 'boolean' },
  { path: 'compaction.maxConsecutiveFailures', type: 'number', min: 1 },
  { path: 'compaction.minTokensFreed', type: 'number', min: 0 },
  { path: 'compaction.warningThreshold', type: 'number', min: 0, max: 1 },
  { path: 'compaction.reserveTokens', type: 'number', min: 0 },
  { path: 'compaction.tailTurns', type: 'number', min: 1 },
  { path: 'experimental', type: 'object' },
]

export function validateConfig(config: AppConfig): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  for (const rule of VALIDATION_RULES) {
    const value = getNestedValue(config as unknown as Record<string, any>, rule.path)
    if (value === undefined) {
      if (rule.required) {
        errors.push(`Missing required config: ${rule.path}`)
      }
      continue
    }

    const actualType = Array.isArray(value) ? 'array' : typeof value
    if (actualType !== rule.type) {
      errors.push(`Config ${rule.path}: expected ${rule.type}, got ${actualType}`)
      continue
    }

    if (rule.type === 'number' && typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`Config ${rule.path}: value ${value} is below minimum ${rule.min}`)
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push(`Config ${rule.path}: value ${value} is above maximum ${rule.max}`)
      }
    }

    if (rule.enum && !rule.enum.includes(value)) {
      errors.push(`Config ${rule.path}: must be one of ${rule.enum.join(', ')}`)
    }
  }

  // Warn about providers without apiKey
  if (config.providers) {
    for (const [name, provider] of Object.entries(config.providers)) {
      if (!provider.apiKey) {
        warnings.push(`Provider "${name}" has no apiKey configured`)
      }
    }
  }

  // Warn about MCP servers without command or url
  if (config.mcp) {
    for (const [name, server] of Object.entries(config.mcp)) {
      if (!server.command && !server.url) {
        warnings.push(`MCP server "${name}" has neither command nor url`)
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ============================================================================
// 10. Singleton Export
// ============================================================================

let instance: ConfigResolver | null = null

export function getConfigResolver(): ConfigResolver {
  if (!instance) {
    instance = new ConfigResolver()
    instance.addSource(loadDefaults())
  }
  return instance
}
