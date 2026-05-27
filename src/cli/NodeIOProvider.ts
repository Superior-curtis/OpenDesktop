import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'
import { execSync, spawn } from 'child_process'
import { IOProvider, setIOProvider } from '../core/CoreContext'
import { FileSystem } from '../core/io/FileSystem'
import { ProcessRunner } from '../core/io/ProcessRunner'
import { WebClient } from '../core/io/WebClient'
import { ConfigStore } from '../core/io/ConfigStore'
import { PlatformInfo } from '../core/io/PlatformInfo'
import { LLMClient } from '../core/io/LLMClient'

const nodeFileSystem: FileSystem = {
  readFile: async (filePath) => fsp.readFile(filePath, 'utf-8'),
  writeFile: async (filePath, content) => fsp.writeFile(filePath, content, 'utf-8'),
  glob: async (pattern, cwd) => {
    const { glob: globModule } = await import('glob')
    const result = await globModule(pattern, { cwd: cwd || process.cwd(), nodir: false })
    return result
  },
  grep: async (pattern, options) => {
    const results: { file: string; line: number; content: string }[] = []
    const { glob: globModule } = await import('glob')
    const files = options?.include
      ? await globModule(options.include, { cwd: options.path || process.cwd() })
      : [options?.path || '.']
    for (const file of files) {
      try {
        const content = await fsp.readFile(path.resolve(options?.path || process.cwd(), file), 'utf-8')
        const lines = content.split('\n')
        const regex = new RegExp(pattern, 'i')
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push({ file, line: i + 1, content: lines[i].trim() })
          }
        }
      } catch { /* skip unreadable files */ }
    }
    return results
  },
  deleteFile: async (filePath) => { await fsp.unlink(filePath) },
  exists: async (filePath) => { try { await fsp.access(filePath); return true } catch { return false } },
  mkdir: async (dirPath) => { await fsp.mkdir(dirPath, { recursive: true }) },
  readdir: async (dirPath) => fsp.readdir(dirPath),
}

const nodeProcessRunner: ProcessRunner = {
  executeCommand: async (command, options) => {
    try {
      const stdout = execSync(command, {
        cwd: options?.cwd,
        env: options?.env ? { ...process.env, ...options.env } : undefined,
        timeout: options?.timeout,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      })
      return { stdout: stdout || '', stderr: '', exitCode: 0 }
    } catch (err: any) {
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || '',
        exitCode: err.status || 1,
      }
    }
  },
  spawn: (command, args, options) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      env: options?.env ? { ...process.env, ...options.env } : undefined,
      shell: true,
    })
    const stdoutCbs: ((data: string) => void)[] = []
    const stderrCbs: ((data: string) => void)[] = []
    const exitCbs: ((code: number) => void)[] = []
    child.stdout?.on('data', (data) => stdoutCbs.forEach(cb => cb(data.toString())))
    child.stderr?.on('data', (data) => stderrCbs.forEach(cb => cb(data.toString())))
    child.on('exit', (code) => exitCbs.forEach(cb => cb(code ?? -1)))
    return {
      onStdout: (cb) => stdoutCbs.push(cb),
      onStderr: (cb) => stderrCbs.push(cb),
      onExit: (cb) => exitCbs.push(cb),
      kill: () => child.kill(),
    }
  },
}

const nodeWebClient: WebClient = {
  fetch: async (url, options) => {
    const response = await fetch(url, {
      method: options?.method || 'GET',
      headers: options?.headers,
      body: options?.body,
    })
    const text = await response.text()
    return options?.maxLength ? text.slice(0, options.maxLength) : text
  },
  search: async (query, numResults) => {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      const html = await nodeWebClient.fetch(url)
      const results: { title: string; url: string; snippet: string }[] = []
      const titleRegex = /<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/gi
      let match
      while ((match = titleRegex.exec(html)) !== null && results.length < (numResults || 5)) {
        results.push({
          title: match[1].replace(/<[^>]*>/g, '').trim(),
          url: '',
          snippet: '',
        })
      }
      return results
    } catch { return [] }
  },
}

const nodeConfigStore: ConfigStore = {
  getItem: (key) => {
    try {
      const dbPath = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.opendesktop', 'config.json')
      if (!fs.existsSync(dbPath)) return null
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
      return data[key] ?? null
    } catch { return null }
  },
  setItem: (key, value) => {
    try {
      const dir = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.opendesktop')
      const dbPath = path.join(dir, 'config.json')
      fs.mkdirSync(dir, { recursive: true })
      const existing = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf-8')) : {}
      existing[key] = value
      fs.writeFileSync(dbPath, JSON.stringify(existing, null, 2), 'utf-8')
    } catch { /* ignore */ }
  },
  removeItem: (key) => {
    try {
      const dbPath = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.opendesktop', 'config.json')
      if (!fs.existsSync(dbPath)) return
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
      delete data[key]
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8')
    } catch { /* ignore */ }
  },
  getAllKeys: () => {
    try {
      const dbPath = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.opendesktop', 'config.json')
      if (!fs.existsSync(dbPath)) return []
      return Object.keys(JSON.parse(fs.readFileSync(dbPath, 'utf-8')))
    } catch { return [] }
  },
}

import os from 'os'

const nodePlatformInfo: PlatformInfo = {
  platform: process.platform as 'win32' | 'darwin' | 'linux',
  userAgent: `Node.js/${process.version}`,
  homeDir: os.homedir(),
  dataDir: path.join(os.homedir(), '.opendesktop'),
  cwd: process.cwd(),
}

async function* nodeLLMChat(
  messages: any[],
  provider: any,
  stream = true,
): AsyncIterableIterator<string> {
  const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const body = JSON.stringify({
    model: provider.model || 'gpt-4o-mini',
    messages: messages.map((m: any) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })),
    stream,
  })
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': provider.apiKey ? `Bearer ${provider.apiKey}` : '',
    },
    body,
  })
  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error')
    throw new Error(`LLM API error ${response.status}: ${errText}`)
  }
  if (!stream) {
    const data: any = await response.json()
    const content = data?.choices?.[0]?.message?.content || ''
    yield content
    return
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      if (trimmed.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(trimmed.slice(6))
          const content = parsed?.choices?.[0]?.delta?.content || ''
          if (content) yield content
        } catch { /* skip malformed SSE */ }
      }
    }
  }
}

const nodeLLMClient: LLMClient = {
  chat: async (messages, options) => {
    const providerStr = nodeConfigStore.getItem('activeProvider')
    let provider: any = { baseUrl: 'http://localhost:4000/v1', model: 'gpt-4o-mini', apiKey: '' }
    if (providerStr) {
      try { provider = JSON.parse(providerStr) } catch { /* use defaults */ }
    }
    return nodeLLMChat(messages, provider, options?.stream ?? true)
  },
  testConnection: async (provider) => {
    try {
      for await (const _ of nodeLLMChat([{ role: 'user', content: 'ping' }], provider, false)) { /* consume */ }
      return true
    } catch { return false }
  },
}

export function createNodeIOProvider(): IOProvider {
  return {
    fileSystem: nodeFileSystem,
    processRunner: nodeProcessRunner,
    webClient: nodeWebClient,
    configStore: nodeConfigStore,
    platformInfo: nodePlatformInfo,
    llmClient: nodeLLMClient,
  }
}

export function initNodeIO(): void {
  setIOProvider(createNodeIOProvider())
}
