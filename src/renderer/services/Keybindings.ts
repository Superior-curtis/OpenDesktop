// ============================================================================
// Keybinding System (based on Claude Code's keybindings/)
// Multi-key sequences, chord parsing, custom bindings, conflict detection
// ============================================================================

export type KeyModifier = 'ctrl' | 'alt' | 'shift' | 'meta' | 'none'

export interface KeyChord {
  key: string
  modifiers: KeyModifier[]
}

export interface KeyBinding {
  id: string
  keys: string           // e.g. "ctrl+k ctrl+d" or "alt+enter"
  description: string
  category: 'navigation' | 'editing' | 'tools' | 'view' | 'general'
  chords: KeyChord[][]    // Parsed sequence (multi-chord support)
  handler: () => void
  enabled: boolean
  when?: string           // Context constraint, e.g. "inputFocus", "!isLoading"
}

export interface KeybindingConflict {
  binding: KeyBinding
  conflictingWith: KeyBinding
  keys: string
}

// ============================================================================
// Key Chord Parsing
// ============================================================================

const MODIFIER_MAP: Record<string, KeyModifier> = {
  'ctrl': 'ctrl',
  'control': 'ctrl',
  'alt': 'alt',
  'option': 'alt',
  'shift': 'shift',
  'meta': 'meta',
  'cmd': 'meta',
  'command': 'meta',
  'super': 'meta',
  'win': 'meta',
  'windows': 'meta',
}

export function parseKeyString(keyStr: string): KeyChord[][] {
  return keyStr.split(/\s+/).map((chordStr) => {
    const parts = chordStr.split('+').map((p) => p.toLowerCase().trim()).filter(Boolean)
    const modifiers: KeyModifier[] = []
    let key = ''

    for (const part of parts) {
      const mod = MODIFIER_MAP[part]
      if (mod) {
        if (!modifiers.includes(mod)) modifiers.push(mod)
      } else {
        key = part
      }
    }

    if (!key && parts.length > 0) {
      key = parts[parts.length - 1]
    }

    return [{ key, modifiers }]
  })
}

export function keyEventToString(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  if (e.metaKey) parts.push('meta')
  parts.push(e.key.toLowerCase())
  return parts.join('+')
}

function chordsEqual(a: KeyChord[], b: KeyChord[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].key !== b[i].key) return false
    const aMods = [...a[i].modifiers].sort()
    const bMods = [...b[i].modifiers].sort()
    if (aMods.join(',') !== bMods.join(',')) return false
  }
  return true
}

// ============================================================================
// Keybinding Manager
// ============================================================================

export class KeybindingManager {
  private bindings: Map<string, KeyBinding> = new Map()
  private chordState: number = 0
  private chordTimeout: ReturnType<typeof setTimeout> | null = null
  private chordBuffer: KeyChord[] = []
  private contexts: Set<string> = new Set()

  private readonly CHORD_TIMEOUT_MS = 1000

  register(binding: KeyBinding): void {
    binding.chords = parseKeyString(binding.keys)
    this.bindings.set(binding.id, binding)
  }

  unregister(id: string): void {
    this.bindings.delete(id)
  }

  getBinding(id: string): KeyBinding | undefined {
    return this.bindings.get(id)
  }

  getAllBindings(): KeyBinding[] {
    return Array.from(this.bindings.values())
  }

  getBindingsByCategory(category: KeyBinding['category']): KeyBinding[] {
    return this.getAllBindings().filter((b) => b.category === category)
  }

  setContext(context: string, active: boolean): void {
    if (active) this.contexts.add(context)
    else this.contexts.delete(context)
  }

  setContexts(contexts: string[]): void {
    this.contexts = new Set(contexts)
  }

  handleKeyEvent(e: KeyboardEvent): boolean {
    const eventStr = keyEventToString(e)

    // Try direct binding first
    for (const binding of this.getEnabledBindings()) {
      if (binding.chords.length === 1 && chordsEqual(binding.chords[0], binding.chords[0])) {
        if (this.matchesEvent(binding, eventStr)) {
          binding.handler()
          e.preventDefault()
          e.stopPropagation()
          return true
        }
      }
    }

    // Try multi-chord (key sequence) matching
    const currentChord: KeyChord = {
      key: e.key.toLowerCase(),
      modifiers: [],
    }
    if (e.ctrlKey) currentChord.modifiers.push('ctrl')
    if (e.altKey) currentChord.modifiers.push('alt')
    if (e.shiftKey) currentChord.modifiers.push('shift')
    if (e.metaKey) currentChord.modifiers.push('meta')

    if (this.chordState > 0) {
      this.chordBuffer.push(currentChord)

      for (const binding of this.getEnabledBindings()) {
        if (binding.chords.length > 1 && this.chordState < binding.chords.length) {
          if (this.matchesChordSequence(binding)) {
            this.resetChordState()
            binding.handler()
            e.preventDefault()
            return true
          }
        }
      }

      // Check if partial match exists
      for (const binding of this.getEnabledBindings()) {
        if (binding.chords.length > this.chordState) {
          if (this.partialMatch(binding)) {
            this.chordState++
            this.resetChordTimeout()
            e.preventDefault()
            return true
          }
        }
      }

      this.resetChordState()
    }

    // Check if any binding starts with this key (entering chord mode)
    for (const binding of this.getEnabledBindings()) {
      if (binding.chords.length > 1 && binding.chords[0].length > 0) {
        const first = binding.chords[0][0]
        if (first.key === currentChord.key &&
            arraysEqual(first.modifiers.sort(), currentChord.modifiers.sort())) {
          this.chordState = 1
          this.chordBuffer = [currentChord]
          this.resetChordTimeout()
          e.preventDefault()
          return true
        }
      }
    }

    return false
  }

  private getEnabledBindings(): KeyBinding[] {
    return this.getAllBindings().filter((b) => {
      if (!b.enabled) return false
      if (b.when) {
        const conditions = b.when.split('&&').map((c) => c.trim())
        for (const cond of conditions) {
          const negate = cond.startsWith('!')
          const ctx = negate ? cond.slice(1) : cond
          const hasContext = this.contexts.has(ctx)
          if (negate ? hasContext : !hasContext) return false
        }
      }
      return true
    })
  }

  private matchesEvent(binding: KeyBinding, eventStr: string): boolean {
    return binding.keys.toLowerCase() === eventStr
  }

  private matchesChordSequence(binding: KeyBinding): boolean {
    if (binding.chords.length !== this.chordBuffer.length) return false
    for (let i = 0; i < binding.chords.length; i++) {
      if (!chordsEqual(binding.chords[i], [this.chordBuffer[i]])) return false
    }
    return true
  }

  private partialMatch(binding: KeyBinding): boolean {
    const target = binding.chords[this.chordState]
    const current = [this.chordBuffer[this.chordBuffer.length - 1]]
    return chordsEqual(target, current)
  }

  private resetChordState(): void {
    this.chordState = 0
    this.chordBuffer = []
    if (this.chordTimeout) {
      clearTimeout(this.chordTimeout)
      this.chordTimeout = null
    }
  }

  private resetChordTimeout(): void {
    if (this.chordTimeout) clearTimeout(this.chordTimeout)
    this.chordTimeout = setTimeout(() => this.resetChordState(), this.CHORD_TIMEOUT_MS)
  }

  findConflicts(): KeybindingConflict[] {
    const conflicts: KeybindingConflict[] = []
    const all = this.getAllBindings()

    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (all[i].keys === all[j].keys) {
          conflicts.push({
            binding: all[i],
            conflictingWith: all[j],
            keys: all[i].keys,
          })
        }
      }
    }
    return conflicts
  }

  exportBindings(): string {
    return this.getAllBindings()
      .map((b) => `- ${b.keys}: ${b.description} [${b.category}]${b.when ? ` (when: ${b.when})` : ''}`)
      .join('\n')
  }

  reset(): void {
    this.bindings.clear()
    this.resetChordState()
    this.contexts.clear()
  }
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

// ============================================================================
// Default bindings
// ============================================================================

export function registerDefaultBindings(manager: KeybindingManager): void {
  const defaults: KeyBinding[] = [
    { id: 'send-message', keys: 'enter', description: 'Send message', category: 'general', chords: [], handler: () => {}, enabled: true, when: 'inputFocus' },
    { id: 'newline', keys: 'shift+enter', description: 'Insert newline', category: 'editing', chords: [], handler: () => {}, enabled: true, when: 'inputFocus' },
    { id: 'cancel', keys: 'escape', description: 'Cancel/stop current action', category: 'general', chords: [], handler: () => {}, enabled: true, when: 'chatView' },
    { id: 'open-command-palette', keys: 'ctrl+k', description: 'Open command palette', category: 'navigation', chords: [], handler: () => {}, enabled: true },
    { id: 'open-settings', keys: 'ctrl+,', description: 'Open settings', category: 'view', chords: [], handler: () => {}, enabled: true },
    { id: 'toggle-sidebar', keys: 'ctrl+b', description: 'Toggle sidebar', category: 'view', chords: [], handler: () => {}, enabled: true },
    { id: 'focus-input', keys: 'ctrl+l', description: 'Focus input area', category: 'navigation', chords: [], handler: () => {}, enabled: true },
    { id: 'clear-conversation', keys: 'ctrl+shift+c', description: 'Clear conversation', category: 'general', chords: [], handler: () => {}, enabled: true },
    { id: 'new-conversation', keys: 'ctrl+n', description: 'New conversation', category: 'navigation', chords: [], handler: () => {}, enabled: true },
    { id: 'toggle-thinking', keys: 'ctrl+shift+t', description: 'Toggle thinking panel', category: 'view', chords: [], handler: () => {}, enabled: true },
    { id: 'search-conversation', keys: 'ctrl+f', description: 'Search in conversation', category: 'navigation', chords: [], handler: () => {}, enabled: true, when: 'inputFocus' },
    { id: 'export-data', keys: 'ctrl+shift+e', description: 'Export all data', category: 'general', chords: [], handler: () => {}, enabled: true },
    { id: 'import-data', keys: 'ctrl+shift+i', description: 'Import data from file', category: 'general', chords: [], handler: () => {}, enabled: true },
    { id: 'nav-chat', keys: 'ctrl+1', description: 'Navigate to chat', category: 'navigation', chords: [], handler: () => {}, enabled: true },
    { id: 'nav-search', keys: 'ctrl+2', description: 'Navigate to search', category: 'navigation', chords: [], handler: () => {}, enabled: true },
    { id: 'nav-files', keys: 'ctrl+3', description: 'Navigate to files', category: 'navigation', chords: [], handler: () => {}, enabled: true },
    { id: 'nav-settings', keys: 'ctrl+4', description: 'Navigate to settings', category: 'navigation', chords: [], handler: () => {}, enabled: true },
    { id: 'nav-providers', keys: 'ctrl+5', description: 'Navigate to provider config', category: 'navigation', chords: [], handler: () => {}, enabled: true },
    { id: 'nav-mcp', keys: 'ctrl+6', description: 'Navigate to MCP servers', category: 'navigation', chords: [], handler: () => {}, enabled: true },
    { id: 'nav-skills', keys: 'ctrl+7', description: 'Navigate to skills', category: 'navigation', chords: [], handler: () => {}, enabled: true },
    { id: 'nav-tools', keys: 'ctrl+8', description: 'Navigate to tools', category: 'navigation', chords: [], handler: () => {}, enabled: true },
    { id: 'nav-agents', keys: 'ctrl+9', description: 'Navigate to agent config', category: 'navigation', chords: [], handler: () => {}, enabled: true },
    { id: 'view-go-back', keys: 'escape', description: 'Go back to previous view', category: 'navigation', chords: [], handler: () => {}, enabled: true, when: '!chatView' },
  ]

  for (const binding of defaults) {
    binding.chords = parseKeyString(binding.keys)
    manager.register(binding)
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalKeybindingManager: KeybindingManager | null = null

export function getKeybindingManager(): KeybindingManager {
  if (!globalKeybindingManager) {
    globalKeybindingManager = new KeybindingManager()
    registerDefaultBindings(globalKeybindingManager)
  }
  return globalKeybindingManager
}
