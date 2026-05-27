// ============================================================================
// LSP Integration — lightweight abstraction layer for Language Server Protocol
// diagnostics, mocking, and built-in rule evaluation.
// ============================================================================

export type DiagnosticSeverity = 1 | 2 | 3 | 4

export interface Position {
  line: number
  character: number
}

export interface Range {
  start: Position
  end: Position
}

export interface Diagnostic {
  range: Range
  severity: DiagnosticSeverity
  message: string
  source?: string
  code?: string | number
  filePath: string
}

export interface DiagnosticCollection {
  filePath: string
  diagnostics: Diagnostic[]
  serverName: string
  timestamp: number
}

// ============================================================================
// LSPDiagnosticRegistry
// ============================================================================

export class LSPDiagnosticRegistry {
  private diagnostics: Map<string, DiagnosticCollection[]> = new Map()
  private listeners: Set<(diagnostics: DiagnosticCollection[]) => void> = new Set()

  setDiagnostics(collection: DiagnosticCollection): void {
    const existing = this.diagnostics.get(collection.filePath) ?? []
    const filtered = existing.filter(c => c.serverName !== collection.serverName)
    filtered.push(collection)
    this.diagnostics.set(collection.filePath, filtered)
    this.notify()
  }

  getDiagnostics(filePath: string): Diagnostic[] {
    return (this.diagnostics.get(filePath) ?? []).flatMap(c => c.diagnostics)
  }

  getAllDiagnostics(): Diagnostic[] {
    const all: Diagnostic[] = []
    for (const collections of this.diagnostics.values()) {
      for (const c of collections) {
        all.push(...c.diagnostics)
      }
    }
    return all
  }

  getErrors(filePath: string): Diagnostic[] {
    return this.getDiagnostics(filePath).filter(d => d.severity === 1)
  }

  getWarnings(filePath: string): Diagnostic[] {
    return this.getDiagnostics(filePath).filter(d => d.severity === 2)
  }

  clearFile(filePath: string): void {
    this.diagnostics.delete(filePath)
    this.notify()
  }

  clearAll(): void {
    this.diagnostics.clear()
    this.notify()
  }

  hasErrors(filePath: string): boolean {
    return this.getDiagnostics(filePath).some(d => d.severity === 1)
  }

  getErrorCount(): number {
    let count = 0
    for (const collections of this.diagnostics.values()) {
      for (const c of collections) {
        count += c.diagnostics.filter(d => d.severity === 1).length
      }
    }
    return count
  }

  getWarningCount(): number {
    let count = 0
    for (const collections of this.diagnostics.values()) {
      for (const c of collections) {
        count += c.diagnostics.filter(d => d.severity === 2).length
      }
    }
    return count
  }

  onChange(callback: (diagnostics: DiagnosticCollection[]) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  toPromptString(filePath?: string): string {
    const diagnostics = filePath
      ? this.getDiagnostics(filePath)
      : this.getAllDiagnostics()

    if (diagnostics.length === 0) return ''

    const lines: string[] = ['## Diagnostics']
    for (const d of diagnostics) {
      const sev = DiagnosticSeverityLabel[d.severity] ?? 'UNKNOWN'
      const loc = `[${d.range.start.line}:${d.range.start.character}]`
      lines.push(`  ${sev} ${loc} ${d.message}${d.code ? ` (${d.code})` : ''}`)
    }
    return lines.join('\n')
  }

  private notify(): void {
    const all: DiagnosticCollection[] = []
    for (const collections of this.diagnostics.values()) {
      all.push(...collections)
    }
    for (const cb of this.listeners) {
      cb(all)
    }
  }
}

const DiagnosticSeverityLabel: Record<number, string> = {
  1: 'ERROR',
  2: 'WARNING',
  3: 'INFO',
  4: 'HINT',
}

// ============================================================================
// LSPClient interface & BasicLSPClient
// ============================================================================

export interface LSPClientConfig {
  serverName: string
  command: string
  args: string[]
  languageIds: string[]
  rootPath: string
}

export interface LSPClient {
  readonly name: string
  readonly isConnected: boolean
  connect(config: LSPClientConfig): Promise<void>
  disconnect(): Promise<void>
  notifyFileOpen(filePath: string, content: string): Promise<void>
  notifyFileChange(filePath: string, content: string): Promise<void>
  notifyFileClose(filePath: string): Promise<void>
  getDiagnostics(): Promise<Diagnostic[]>
}

export class BasicLSPClient implements LSPClient {
  readonly name: string
  private _isConnected = false
  private openFiles: Set<string> = new Set()
  private diagnostics: Diagnostic[] = []

  constructor(name: string) {
    this.name = name
  }

  get isConnected(): boolean {
    return this._isConnected
  }

  async connect(_config: LSPClientConfig): Promise<void> {
    this._isConnected = true
    this.openFiles.clear()
    this.diagnostics = []
  }

  async disconnect(): Promise<void> {
    this._isConnected = false
    this.openFiles.clear()
    this.diagnostics = []
  }

  async notifyFileOpen(filePath: string, _content: string): Promise<void> {
    this.openFiles.add(filePath)
  }

  async notifyFileChange(_filePath: string, _content: string): Promise<void> {
    // no-op in basic implementation
  }

  async notifyFileClose(filePath: string): Promise<void> {
    this.openFiles.delete(filePath)
  }

  async setMockDiagnostics(diagnostics: Diagnostic[]): Promise<void> {
    this.diagnostics = diagnostics
  }

  async getDiagnostics(): Promise<Diagnostic[]> {
    return this.diagnostics
  }
}

// ============================================================================
// LSPManager singleton
// ============================================================================

let globalManager: LSPManager | null = null

export class LSPManager {
  private clients: Map<string, LSPClient> = new Map()
  private registry: LSPDiagnosticRegistry = new LSPDiagnosticRegistry()

  registerClient(client: LSPClient): void {
    this.clients.set(client.name, client)
  }

  unregisterClient(name: string): void {
    this.clients.delete(name)
  }

  getClient(name: string): LSPClient | undefined {
    return this.clients.get(name)
  }

  getRegistry(): LSPDiagnosticRegistry {
    return this.registry
  }

  async connectAll(configs: LSPClientConfig[]): Promise<void> {
    await Promise.all(configs.map(async cfg => {
      const existing = this.clients.get(cfg.serverName)
      if (existing) {
        await existing.connect(cfg)
      }
    }))
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(Array.from(this.clients.values()).map(c => c.disconnect()))
  }

  getConnectedClients(): string[] {
    return Array.from(this.clients.values())
      .filter(c => c.isConnected)
      .map(c => c.name)
  }

  isAnyConnected(): boolean {
    return Array.from(this.clients.values()).some(c => c.isConnected)
  }
}

export function getLSPManager(): LSPManager {
  if (!globalManager) {
    globalManager = new LSPManager()
  }
  return globalManager
}

// ============================================================================
// Language ID mapping
// ============================================================================

const extensionToLanguageId: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.scala': 'scala',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',
  '.hs': 'haskell',
  '.ml': 'ocaml',
  '.fs': 'fsharp',
  '.fsx': 'fsharp',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.astro': 'astro',
  '.sql': 'sql',
  '.sh': 'shellscript',
  '.bash': 'shellscript',
  '.zsh': 'shellscript',
  '.ps1': 'powershell',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.jsonc': 'jsonc',
  '.md': 'markdown',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'html',
  '.xml': 'xml',
  '.toml': 'toml',
  '.dart': 'dart',
  '.lua': 'lua',
  '.r': 'r',
  '.pl': 'perl',
  '.pm': 'perl',
}

export function getLanguageId(filePath: string): string | undefined {
  const idx = filePath.lastIndexOf('.')
  if (idx === -1) return undefined
  const ext = filePath.slice(idx).toLowerCase()
  return extensionToLanguageId[ext]
}

// ============================================================================
// Built-in diagnostic rules (regex-based, no LSP server needed)
// ============================================================================

export function getBuiltinDiagnostics(filePath: string, content: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const lines = content.split('\n')
  const addDiag = (severity: DiagnosticSeverity, line: number, character: number, message: string, code?: string) => {
    diagnostics.push({
      range: { start: { line, character }, end: { line, character: character + 1 } },
      severity,
      message,
      filePath,
      source: 'builtin',
      code,
    })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Trailing whitespace
    const tw = line.match(/[ \t]+$/)
    if (tw) {
      addDiag(2, i, line.length - tw[0].length, 'Trailing whitespace', 'trailing-whitespace')
    }

    // Long lines
    if (line.length > 120) {
      addDiag(3, i, 120, `Line exceeds 120 characters (${line.length})`, 'line-too-long')
    }

    // TODO / FIXME / HACK comments
    const todoMatch = line.match(/\b(TODO|FIXME|HACK|XXX)\b/)
    if (todoMatch) {
      addDiag(3, i, line.indexOf(todoMatch[1]), `${todoMatch[1]} comment left in code`, `${todoMatch[1].toLowerCase()}-comment`)
    }

    // console.log left in code
    if (/console\.(log|debug|info|warn|error)\s*\(/.test(line) && !line.trimStart().startsWith('//')) {
      addDiag(2, i, line.indexOf('console'), 'console.log left in code', 'console-log')
    }
  }

  // Missing newline at EOF
  if (lines.length > 1 && lines[lines.length - 1] !== '') {
    addDiag(2, lines.length - 1, 0, 'Missing newline at end of file', 'missing-eol')
  }

  // Duplicate imports
  const importMatches = content.matchAll(/^(?:import\s+(?:\{[^}]*\}|[^;]+?)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"])/gm)
  const seen = new Map<string, number[]>()
  for (const m of importMatches) {
    const specifier = m[1] ?? m[2]
    if (specifier) {
      const existing = seen.get(specifier) ?? []
      existing.push(m.index!)
      seen.set(specifier, existing)
    }
  }
  for (const [specifier, positions] of seen) {
    if (positions.length > 1) {
      for (let i = 1; i < positions.length; i++) {
        const lineIdx = content.slice(0, positions[i]).split('\n').length - 1
        addDiag(3, lineIdx, 0, `Duplicate import: "${specifier}"`, 'duplicate-import')
      }
    }
  }

  return diagnostics
}
