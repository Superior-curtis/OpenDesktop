// ============================================================================
// Session Persistence (based on Claude Code's sessionStorage)
// JSONL-based format with lite reads, resume, and file history
// ============================================================================

export type SessionEntryType = 'user' | 'assistant' | 'system' | 'attachment'

export interface SessionEntry {
  uuid: string
  type: SessionEntryType
  timestamp: string
  parentUuid: string | null
  content?: string
  toolName?: string
  toolCallId?: string
  metadata?: Record<string, any>
}

export interface SessionMetadata {
  sessionId: string
  projectDir: string
  model: string
  createdAt: string
  updatedAt: string
  title: string
  turnCount: number
  customTitle?: string
  agentName?: string
  agentId?: string
}

export interface SessionLiteInfo {
  sessionId: string
  title: string
  model: string
  createdAt: string
  updatedAt: string
  turnCount: number
  fileSize: number
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

// ============================================================================
// Lite JSON extraction (no full parse)
// ============================================================================

function extractJsonField(text: string, key: string): string | null {
  const patterns = [`"${key}":"`, `"${key}": "`]
  for (const pattern of patterns) {
    const idx = text.indexOf(pattern)
    if (idx < 0) continue
    const start = idx + pattern.length
    let i = start
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue }
      if (text[i] === '"') return text.slice(start, i)
      i++
    }
  }
  return null
}

// ============================================================================
// Session CRUD
// ============================================================================

export async function createSession(
  model: string,
  projectDir?: string,
  title?: string,
): Promise<SessionMetadata> {
  const sessionId = generateUuid()
  const now = new Date().toISOString()
  const meta: SessionMetadata = {
    sessionId,
    projectDir: projectDir || '',
    model,
    createdAt: now,
    updatedAt: now,
    title: title || `Session ${new Date().toLocaleDateString()}`,
    turnCount: 0,
  }
  await appendSessionEntry(sessionId, {
    uuid: generateUuid(),
    type: 'system',
    timestamp: now,
    parentUuid: null,
    content: JSON.stringify(meta),
    metadata: { type: 'session_metadata' },
  })
  return meta
}

export async function appendSessionEntry(
  sessionId: string,
  entry: SessionEntry,
): Promise<void> {
  try {
    const line = JSON.stringify(entry) + '\n'
    // Use localStorage for persistence (simplified for browser/Electron)
    const key = `session_${sessionId}`
    const existing = localStorage.getItem(key) || ''
    localStorage.setItem(key, existing + line)
  } catch (e) {
    console.error('Failed to append session entry:', e)
  }
}

export async function appendMessage(
  sessionId: string,
  message: {
    id: string
    role: string
    content: string
    timestamp: number
    toolName?: string
    toolCallId?: string
  },
): Promise<void> {
  if (message.role === 'tool') return
  await appendSessionEntry(sessionId, {
    uuid: message.id,
    type: message.role as SessionEntryType,
    timestamp: new Date(message.timestamp).toISOString(),
    parentUuid: null,
    content: message.content,
    toolName: message.toolName,
    toolCallId: message.toolCallId,
  })
}

export async function loadSession(sessionId: string): Promise<SessionEntry[]> {
  try {
    const key = `session_${sessionId}`
    const data = localStorage.getItem(key)
    if (!data) return []
    return data.split('\n').filter(Boolean).map((line) => JSON.parse(line))
  } catch {
    return []
  }
}

export async function loadTranscript(sessionId: string): Promise<SessionEntry[]> {
  const entries = await loadSession(sessionId)
  return entries.filter((e) =>
    e.type === 'user' || e.type === 'assistant' || e.type === 'system',
  )
}

export async function listSessions(): Promise<SessionLiteInfo[]> {
  const sessions: SessionLiteInfo[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith('session_')) continue
    const sessionId = key.slice(8)
    const data = localStorage.getItem(key) || ''
    const firstLine = data.split('\n')[0]
    if (!firstLine) continue

    const title = extractJsonField(firstLine, 'title') ?? 'Untitled'
    const model = extractJsonField(firstLine, 'model') ?? 'unknown'
    const createdAt = extractJsonField(firstLine, 'createdAt') ?? ''
    const updatedAt = extractJsonField(firstLine, 'updatedAt') ?? ''
    const turnCountStr = extractJsonField(firstLine, 'turnCount') ?? '0'

    sessions.push({
      sessionId,
      title,
      model,
      createdAt,
      updatedAt,
      turnCount: parseInt(turnCountStr, 10) || 0,
      fileSize: data.length,
    })
  }
  return sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export async function deleteSession(sessionId: string): Promise<void> {
  localStorage.removeItem(`session_${sessionId}`)
}

export async function updateSessionTitle(
  sessionId: string,
  title: string,
): Promise<void> {
  const entries = await loadSession(sessionId)
  if (entries.length === 0) return

  // Update metadata entry
  const metaEntry = entries[0]
  if (metaEntry.metadata?.type === 'session_metadata' && metaEntry.content) {
    try {
      const meta = JSON.parse(metaEntry.content) as SessionMetadata
      meta.title = title
      meta.updatedAt = new Date().toISOString()
      metaEntry.content = JSON.stringify(meta)
    } catch { /* ignore */ }
  }

  // Rewrite session
  const key = `session_${sessionId}`
  localStorage.setItem(key, entries.map((e) => JSON.stringify(e)).join('\n') + '\n')
}

// ============================================================================
// Resume helpers
// ============================================================================

export async function getLastAssistantContent(sessionId: string): Promise<string | null> {
  const entries = await loadSession(sessionId)
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].type === 'assistant' && entries[i].content) {
      return entries[i].content ?? null
    }
  }
  return null
}

export function exportSessionAsJson(sessionId: string): string | null {
  const key = `session_${sessionId}`
  const data = localStorage.getItem(key)
  return data || null
}
