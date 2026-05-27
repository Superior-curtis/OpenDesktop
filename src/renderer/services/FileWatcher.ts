// ============================================================================
// File System Watcher (based on Claude Code's fileChangedWatcher)
// Hook-driven, with timestamps for staleness detection
// ============================================================================

export interface WatchTarget {
  path: string
  pattern?: string
  recursive?: boolean
}

export type WatchEventType = 'change' | 'add' | 'unlink'

export interface WatchEvent {
  type: WatchEventType
  path: string
  timestamp: number
  target: WatchTarget
}

export type FileChangeCallback = (event: WatchEvent) => void

interface WatchedFile {
  target: WatchTarget
  lastMtime: number
  callbacks: Set<FileChangeCallback>
  pollingTimer?: ReturnType<typeof setInterval>
}

export class FileWatcher {
  private watched: Map<string, WatchedFile> = new Map()
  private defaultPollInterval = 2000

  // Watch a file or pattern for changes
  watch(target: WatchTarget, callback: FileChangeCallback): () => void {
    const key = `${target.path}|${target.pattern ?? ''}`

    let entry = this.watched.get(key)
    if (!entry) {
      entry = {
        target,
        lastMtime: Date.now(),
        callbacks: new Set(),
      }
      this.watched.set(key, entry)
      this.startPolling(entry)
    }

    entry.callbacks.add(callback)

    return () => {
      entry?.callbacks.delete(callback)
      if (entry && entry.callbacks.size === 0) {
        this.stopPolling(key)
        this.watched.delete(key)
      }
    }
  }

  private startPolling(entry: WatchedFile): void {
    entry.pollingTimer = setInterval(async () => {
      await this.checkFile(entry)
    }, this.defaultPollInterval)
  }

  private stopPolling(key: string): void {
    const entry = this.watched.get(key)
    if (entry?.pollingTimer) {
      clearInterval(entry.pollingTimer)
    }
  }

  private async checkFile(entry: WatchedFile): Promise<void> {
    try {
      const mtime = await this.getMtime(entry.target.path)
      if (mtime > entry.lastMtime) {
        entry.lastMtime = mtime

        const event: WatchEvent = {
          type: 'change',
          path: entry.target.path,
          timestamp: mtime,
          target: entry.target,
        }

        for (const cb of entry.callbacks) {
          try { cb(event) } catch { /* ignore */ }
        }
      }
    } catch {
      // File might not exist yet - that's ok
    }
  }

  // Get file modification time via Electron IPC or Date fallback
  private async getMtime(filePath: string): Promise<number> {
    try {
      const result = await window.api.executeCommand(
        `(Get-Item "${filePath.replace(/"/g, '`"')}").LastWriteTime.ToString("O")`,
        { timeout: 3000 },
      )
      if (result.exitCode === 0) {
        return new Date(result.stdout.trim()).getTime()
      }
    } catch { /* fall through */ }

    // Fallback: stat via fetch
    try {
      const content = await window.api.readFile(filePath)
      // Use content length as a weak mtime proxy when real mtime is unavailable
      if (content.length > 0) {
        return Date.now()
      }
    } catch { /* file doesn't exist */ }

    return 0
  }

  async checkNow(target: WatchTarget): Promise<boolean> {
    const key = `${target.path}|${target.pattern ?? ''}`
    const entry = this.watched.get(key)
    if (!entry) return false

    const mtime = await this.getMtime(target.path)
    const changed = mtime > entry.lastMtime
    if (changed) {
      entry.lastMtime = mtime
    }
    return changed
  }

  unwatchAll(): void {
    for (const key of this.watched.keys()) {
      this.stopPolling(key)
    }
    this.watched.clear()
  }

  getWatchedCount(): number {
    return this.watched.size
  }

  // Watch the current project directory for relevant file changes
  watchProject(projectDir: string, callback: FileChangeCallback): () => void {
    const unsubs: Array<() => void> = []

    // Watch common config files
    const configFiles = [
      '.env', '.env.local',
      '.gitignore',
      'package.json',
      'tsconfig.json',
    ]

    for (const file of configFiles) {
      unsubs.push(
        this.watch({ path: `${projectDir}/${file}` }, callback),
      )
    }

    return () => {
      for (const unsub of unsubs) unsub()
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalWatcher: FileWatcher | null = null

export function getFileWatcher(): FileWatcher {
  if (!globalWatcher) globalWatcher = new FileWatcher()
  return globalWatcher
}

export function resetFileWatcher(): void {
  globalWatcher?.unwatchAll()
  globalWatcher = null
}
