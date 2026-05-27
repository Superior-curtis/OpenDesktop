import { IOProvider } from '../../core/CoreContext'
import { FileSystem } from '../../core/io/FileSystem'
import { ProcessRunner } from '../../core/io/ProcessRunner'
import { WebClient } from '../../core/io/WebClient'
import { ConfigStore } from '../../core/io/ConfigStore'
import { PlatformInfo } from '../../core/io/PlatformInfo'
import { LLMClient } from '../../core/io/LLMClient'
import { ApiClient } from '../services/ApiClient'

const electronFileSystem: FileSystem = {
  readFile: async (filePath) => {
    const result = await window.api.readFile(filePath)
    return typeof result === 'string' ? result : (result as any).content ?? ''
  },
  writeFile: async (filePath, content) => {
    await window.api.writeFile(filePath, content)
  },
  glob: async (pattern, cwd) => {
    const result = await window.api.glob(pattern, cwd ? { cwd } : undefined)
    return Array.isArray(result) ? result : (result as any).files ?? []
  },
  grep: async (pattern, options) => {
    const result = await window.api.grep(pattern, options)
    return Array.isArray(result) ? result.map((r: any) => typeof r === 'string' ? { file: '', line: 0, content: r } : r) : (result as any).results ?? []
  },
  deleteFile: async (_filePath) => {
    throw new Error('deleteFile not implemented via Electron bridge')
  },
  exists: async (_filePath) => {
    try {
      await window.api.readFile(_filePath)
      return true
    } catch { return false }
  },
  mkdir: async () => { throw new Error('mkdir not implemented via Electron bridge') },
  readdir: async () => { throw new Error('readdir not implemented via Electron bridge') },
}

const electronProcessRunner: ProcessRunner = {
  executeCommand: async (command, options) => {
    const result = await window.api.executeCommand(command, options)
    if (result && 'stdout' in result) return result as any
    const r = result as any
    return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', exitCode: r.exitCode ?? r.code ?? 0 }
  },
  spawn: () => { throw new Error('spawn not implemented via Electron bridge') },
}

const electronWebClient: WebClient = {
  fetch: async (url, options) => {
    const response = await fetch(url, { method: options?.method, headers: options?.headers, body: options?.body })
    const text = await response.text()
    return options?.maxLength ? text.slice(0, options.maxLength) : text
  },
  search: async (query, numResults) => {
    const result = await window.api.webSearch(query, numResults || 5)
    return Array.isArray(result) ? result : []
  },
}

const electronConfigStore: ConfigStore = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => { localStorage.setItem(key, value) },
  removeItem: (key) => { localStorage.removeItem(key) },
  getAllKeys: () => { const keys: string[] = []; for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)!); return keys },
}

const electronPlatformInfo: PlatformInfo = {
  platform: (navigator.platform?.toLowerCase().includes('win') ? 'win32' : navigator.platform?.toLowerCase().includes('mac') ? 'darwin' : 'linux') as any,
  userAgent: navigator.userAgent,
  homeDir: '',
  dataDir: '',
  cwd: window.location?.pathname || '',
}

const electronLLMClient: LLMClient = {
  chat: async (messages, options) => {
    const providerStr = localStorage.getItem('opendesktop-chat-store-v1')
    let provider: any = {}
    try {
      if (providerStr) {
        const parsed = JSON.parse(providerStr)
        const state = parsed?.state
        if (state?.providers?.length) {
          const activeId = state.activeProviderId || state.providers[0]?.id
          provider = state.providers.find((p: any) => p.id === activeId) || state.providers[0]
        }
      }
    } catch { /* ignore */ }
    const client = new ApiClient(provider)
    const apiMessages = messages.map((m: any) => ({ id: m.id || crypto.randomUUID(), role: m.role, content: m.content, timestamp: m.timestamp || Date.now() }))
    return client.chat(apiMessages, options?.stream ?? true, options?.thinking ?? false, options?.budgetTokens ?? 0)
  },
  testConnection: async (provider) => {
    const client = new ApiClient(provider)
    try {
      const msg = { id: crypto.randomUUID(), role: 'user' as const, content: 'ping', timestamp: Date.now() }
      await client.chat([msg], false, false, 0)
      return true
    } catch { return false }
  },
}

export const electronIOProvider: IOProvider = {
  fileSystem: electronFileSystem,
  processRunner: electronProcessRunner,
  webClient: electronWebClient,
  configStore: electronConfigStore,
  platformInfo: electronPlatformInfo,
  llmClient: electronLLMClient,
}
