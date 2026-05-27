// ============================================================================
// Settings Manager (based on Claude Code's settings architecture)
// Multi-layer settings with priority, schema validation, persistence
// ============================================================================

// ============================================================================
// 1. Setting Source Types
// ============================================================================

export type SettingSource = 'policy' | 'user' | 'project' | 'local' | 'cli' | 'default'
export type SettingPriority = 0 | 1 | 2 | 3 | 4 | 5

export const SETTING_PRIORITY: Record<SettingSource, SettingPriority> = {
  policy: 4,
  user: 3,
  project: 2,
  local: 1,
  cli: 5,
  default: 0,
}

// ============================================================================
// 2. Setting Value Types
// ============================================================================

export type SettingValue = string | number | boolean | Record<string, any> | any[]

export interface SettingEntry {
  value: SettingValue
  source: SettingSource
  timestamp: number
  description?: string
}

// ============================================================================
// 3. Settings Manager
// ============================================================================

const HIGH_TO_LOW: SettingSource[] = ['cli', 'policy', 'user', 'project', 'local', 'default']
const LOW_TO_HIGH: SettingSource[] = ['default', 'local', 'project', 'user', 'policy', 'cli']

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

function flattenObject(obj: Record<string, any>, prefix: string): Record<string, SettingValue> {
  const result: Record<string, SettingValue> = {}
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, any>, path))
    } else {
      result[path] = value as SettingValue
    }
  }
  return result
}

type WatchCallback = (newValue: SettingValue, oldValue: SettingValue | undefined) => void

export class SettingsManager {
  private layers: Map<SettingSource, Map<string, SettingEntry>>
  private watchers: Map<string, Set<WatchCallback>>

  constructor() {
    this.layers = new Map()
    this.watchers = new Map()
  }

  set(path: string, value: SettingValue, source: SettingSource): void {
    let layer = this.layers.get(source)
    if (!layer) {
      layer = new Map()
      this.layers.set(source, layer)
    }
    const oldValue = this.get<SettingValue>(path)
    layer.set(path, { value, source, timestamp: Date.now() })
    const newValue = this.get<SettingValue>(path)
    if (oldValue !== newValue) {
      this.notifyWatchers(path, newValue!, oldValue)
    }
  }

  get<T extends SettingValue = SettingValue>(path: string): T | undefined {
    return getNestedValue(this.getAll(), path) as T | undefined
  }

  getWithSource<T extends SettingValue = SettingValue>(
    path: string,
  ): { value: T; source: SettingSource } | undefined {
    for (const source of HIGH_TO_LOW) {
      const layer = this.layers.get(source)
      if (layer?.has(path)) {
        return { value: layer.get(path)!.value as T, source }
      }
    }
    return undefined
  }

  getAll(): Record<string, SettingValue> {
    const result: Record<string, any> = {}
    for (const source of LOW_TO_HIGH) {
      const layer = this.layers.get(source)
      if (!layer) continue
      for (const [path, entry] of layer) {
        setNestedValue(result, path, entry.value)
      }
    }
    return result
  }

  getLayer(source: SettingSource): Record<string, SettingValue> {
    const layer = this.layers.get(source)
    if (!layer) return {}
    const result: Record<string, any> = {}
    for (const [path, entry] of layer) {
      setNestedValue(result, path, entry.value)
    }
    return result
  }

  remove(path: string, source: SettingSource): boolean {
    const layer = this.layers.get(source)
    if (!layer) return false
    const oldValue = this.get<SettingValue>(path)
    const deleted = layer.delete(path)
    if (deleted) {
      const newValue = this.get<SettingValue>(path)
      if (oldValue !== newValue && newValue !== undefined) {
        this.notifyWatchers(path, newValue, oldValue)
      }
      if (layer.size === 0) {
        this.layers.delete(source)
      }
    }
    return deleted
  }

  reset(source: SettingSource): void {
    this.layers.delete(source)
  }

  has(path: string): boolean {
    for (const source of HIGH_TO_LOW) {
      const layer = this.layers.get(source)
      if (layer?.has(path)) return true
    }
    return false
  }

  watch(path: string, callback: WatchCallback): () => void {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, new Set())
    }
    this.watchers.get(path)!.add(callback)
    return () => {
      this.watchers.get(path)?.delete(callback)
    }
  }

  private notifyWatchers(path: string, newValue: SettingValue, oldValue: SettingValue | undefined): void {
    const callbacks = this.watchers.get(path)
    if (!callbacks) return
    for (const cb of callbacks) {
      cb(newValue, oldValue)
    }
  }
}

// ============================================================================
// 4. Schema Validation
// ============================================================================

export type SettingType = 'string' | 'number' | 'boolean' | 'object' | 'array'

export interface SettingSchema {
  type: SettingType
  default?: SettingValue
  description?: string
  enum?: SettingValue[]
  required?: boolean
  min?: number
  max?: number
  pattern?: string
}

export interface SettingsSchema {
  [path: string]: SettingSchema
}

export function validateSetting(
  schema: SettingsSchema,
  path: string,
  value: SettingValue,
): { valid: boolean; error?: string; coerced?: SettingValue } {
  const settingSchema = schema[path]
  if (!settingSchema) {
    return { valid: false, error: `Unknown setting: ${path}` }
  }

  const actualType = Array.isArray(value) ? 'array' : typeof value
  const expectedType = settingSchema.type

  if (expectedType === 'array' && !Array.isArray(value)) {
    return { valid: false, error: `Expected array for ${path}, got ${actualType}` }
  }

  if (expectedType !== 'array' && actualType !== expectedType) {
    const coerced = coerceValue(value, expectedType as SettingType)
    if (coerced !== undefined) {
      return validateSetting(schema, path, coerced)
    }
    return { valid: false, error: `Expected ${expectedType} for ${path}, got ${actualType}` }
  }

  if (settingSchema.enum && !settingSchema.enum.includes(value)) {
    return {
      valid: false,
      error: `Value ${value} for ${path} must be one of: ${settingSchema.enum.join(', ')}`,
    }
  }

  if (expectedType === 'number' && typeof value === 'number') {
    if (settingSchema.min !== undefined && value < settingSchema.min) {
      return { valid: false, error: `Value ${value} for ${path} is below minimum ${settingSchema.min}` }
    }
    if (settingSchema.max !== undefined && value > settingSchema.max) {
      return { valid: false, error: `Value ${value} for ${path} is above maximum ${settingSchema.max}` }
    }
  }

  if (expectedType === 'string' && typeof value === 'string' && settingSchema.pattern) {
    const regex = new RegExp(settingSchema.pattern)
    if (!regex.test(value)) {
      return { valid: false, error: `Value ${value} for ${path} does not match pattern ${settingSchema.pattern}` }
    }
  }

  return { valid: true }
}

function coerceValue(value: SettingValue, targetType: SettingType): SettingValue | undefined {
  if (targetType === 'string') {
    return String(value)
  }
  if (targetType === 'number') {
    const num = Number(value)
    if (!isNaN(num)) return num
    return undefined
  }
  if (targetType === 'boolean') {
    if (value === 'true' || value === '1') return true
    if (value === 'false' || value === '0') return false
    return undefined
  }
  return undefined
}

// ============================================================================
// 5. Built-in Settings Schema
// ============================================================================

export const BUILT_IN_SETTINGS: SettingsSchema = {
  'theme.mode': { type: 'string', default: 'light', description: 'UI theme mode', enum: ['light', 'dark', 'system'] },
  'theme.fontSize': { type: 'string', default: 'medium', description: 'UI font size', enum: ['small', 'medium', 'large'] },
  'editor.tabSize': { type: 'number', default: 2, description: 'Editor tab size', enum: [2, 4, 8] },
  'editor.wordWrap': { type: 'boolean', default: true, description: 'Enable word wrap' },
  'editor.minimap': { type: 'boolean', default: true, description: 'Show minimap' },
  'ai.model': { type: 'string', default: 'claude-sonnet-4-20250514', description: 'AI model identifier' },
  'ai.temperature': { type: 'number', default: 0.7, description: 'AI temperature (0-2)', min: 0, max: 2 },
  'ai.maxTokens': { type: 'number', default: 8192, description: 'Maximum output tokens' },
  'ai.thinking.enabled': { type: 'boolean', default: false, description: 'Enable AI thinking mode' },
  'ai.thinking.budget': { type: 'number', default: 16000, description: 'Thinking budget tokens' },
  'permissions.mode': { type: 'string', default: 'default', description: 'Permission mode', enum: ['default', 'acceptEdits', 'bypassPermissions', 'auto'] },
  'permissions.alwaysAllowReads': { type: 'boolean', default: false, description: 'Always allow file reads' },
  'privacy.telemetry': { type: 'boolean', default: true, description: 'Send telemetry' },
  'privacy.errorReporting': { type: 'boolean', default: true, description: 'Send error reports' },
  'developerMode': { type: 'boolean', default: false, description: 'Enable developer mode' },
  'output.style': { type: 'string', default: 'concise', description: 'Output style', enum: ['concise', 'detailed', 'verbose'] },
  'output.maxChars': { type: 'number', default: 10000, description: 'Max output characters' },
}

// ============================================================================
// 6. Debounced Change Detection
// ============================================================================

export function createDebouncedChangeDetector(delayMs: number): {
  detect: () => void
  onChange: (cb: () => void) => () => void
  flush: () => void
  clear: () => void
} {
  let timer: ReturnType<typeof setTimeout> | null = null
  let changeCallbacks: Set<() => void> = new Set()
  let pending = false

  function detect(): void {
    pending = true
    if (timer !== null) return
    timer = setTimeout(() => {
      timer = null
      if (pending) {
        pending = false
        for (const cb of changeCallbacks) {
          cb()
        }
      }
    }, delayMs)
  }

  function onChange(cb: () => void): () => void {
    changeCallbacks.add(cb)
    return () => {
      changeCallbacks.delete(cb)
    }
  }

  function flush(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (pending) {
      pending = false
      for (const cb of changeCallbacks) {
        cb()
      }
    }
  }

  function clear(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    pending = false
    changeCallbacks = new Set()
  }

  return { detect, onChange, flush, clear }
}

// ============================================================================
// 7. Persistence
// ============================================================================

const STORAGE_KEY = 'opencode_settings_user'

export function persistSettings(manager: SettingsManager): void {
  const userLayer = manager.getLayer('user')
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userLayer))
  } catch {
    // Storage full or unavailable
  }
}

export function loadPersistedSettings(manager: SettingsManager): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return
    const parsed: Record<string, any> = JSON.parse(stored)
    const allSettings = flattenObject(parsed, '')
    for (const [path, value] of Object.entries(allSettings)) {
      manager.set(path, value, 'user')
    }
  } catch {
    // Corrupt data or storage unavailable
  }
}

// ============================================================================
// 8. ConfigResolver Integration
// ============================================================================

export function applyConfigToSettings(
  settingsManager: SettingsManager,
  configResolver: { resolve: () => Record<string, any>; get: (path: string) => any },
): void {
  const config = configResolver.resolve()
  if (!config) return

  const settingsMap: Record<string, string> = {
    'theme.mode': 'theme',
    'model': 'ai.model',
    'permissions.mode': 'permissions.mode',
    'developerMode': 'developerMode',
    'output.style': 'output.style',
  }

  for (const [configPath, settingPath] of Object.entries(settingsMap)) {
    const value = configResolver.get(configPath)
    if (value !== undefined) {
      settingsManager.set(settingPath, value, 'project')
    }
  }

  if (config.providers) {
    const providers = config.providers as Record<string, { apiKey?: string; baseUrl?: string; models?: string[] }>
    for (const [name, provider] of Object.entries(providers)) {
      if (provider.apiKey) {
        settingsManager.set(`providers.${name}.apiKey`, provider.apiKey, 'project')
      }
      if (provider.baseUrl) {
        settingsManager.set(`providers.${name}.baseUrl`, provider.baseUrl, 'project')
      }
    }
  }

  if (config.mcp) {
    const servers: Record<string, any> = {}
    const mcps = config.mcp as Record<string, { command?: string; args?: string[]; url?: string; enabled?: boolean; env?: Record<string, string> }>
    for (const [name, cfg] of Object.entries(mcps)) {
      servers[name] = { ...cfg, enabled: cfg.enabled !== false }
    }
    if (Object.keys(servers).length > 0) {
      settingsManager.set('mcp.servers', servers, 'project')
    }
  }
}

// ============================================================================
// 9. Singleton Export
// ============================================================================

let instance: SettingsManager | null = null

export function getSettingsManager(): SettingsManager {
  if (!instance) {
    instance = new SettingsManager()
  }
  return instance
}
