import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'

// Wrap imports in try-catch to prevent startup crashes
let registry: any, systemSkills: any, browserSkills: any, browserController: any, mcpClient: any
let backgroundAgent: any

try {
  const skillRegistry = require('./skills/SkillRegistry')
  const sysSkills = require('./skills/systemSkills')
  const brSkills = require('./skills/browserSkills')
  const mcp = require('./mcp/MCPClient')
  registry = skillRegistry.registry
  systemSkills = sysSkills.systemSkills
  browserSkills = brSkills.browserSkills
  browserController = brSkills.browserController
  mcpClient = mcp.mcpClient
} catch (error) {
  console.error('Failed to load skills/MCP modules:', error)
  registry = { register: () => {}, getAll: () => [], get: () => null }
  systemSkills = []
  browserSkills = []
  browserController = { close: () => {} }
  mcpClient = {
    connect: async () => ({ success: false }),
    disconnect: async () => ({ success: true }),
    listTools: async () => [],
    executeTool: async () => ({ success: false }),
    getConnectedServers: () => [],
  }
}

try {
  const agent = require('./BackgroundAgent')
  backgroundAgent = agent
} catch {
  backgroundAgent = {
    getAgentState: () => ({ tasks: [], isRunning: false }),
    addTask: () => ({}),
    removeTask: () => false,
    toggleTask: () => false,
    startAgent: () => {},
    stopAgent: () => {},
  }
}

let executeToolFn: any, toolDefinitions: any, getRiskLevelFn: any
let getSystemContextFn: any, formatSystemPromptFn: any, formatMemoryPromptFn: any
let setupPermissionIPCFn: any, checkPermissionFn: any

try {
  const cct = require('./ClaudeCodeTools')
  executeToolFn = cct.executeTool
  toolDefinitions = cct.toolDefinitions
  getRiskLevelFn = cct.getRiskLevel

  const ccc = require('./ClaudeCodeContext')
  getSystemContextFn = ccc.getSystemContext
  formatSystemPromptFn = ccc.formatSystemPrompt
  formatMemoryPromptFn = ccc.formatMemoryPrompt

  const ps = require('./PermissionSystem')
  setupPermissionIPCFn = ps.setupPermissionIPC
  checkPermissionFn = ps.checkPermission
} catch (error) {
  console.error('Failed to load Claude Code modules:', error)
  executeToolFn = async () => ({ success: false, output: '', error: 'Tool system unavailable' })
  toolDefinitions = []
  getRiskLevelFn = () => 'moderate'
  getSystemContextFn = async () => ({ currentDate: new Date().toISOString(), os: process.platform, platform: process.platform, arch: process.arch, nodeVersion: process.version, cwd: process.cwd(), homeDir: process.env.HOME || '', tempDir: process.env.TEMP || '', isGitRepo: false, workspacePath: process.cwd() })
  formatSystemPromptFn = async () => ''
  formatMemoryPromptFn = () => ''
  setupPermissionIPCFn = () => {}
  checkPermissionFn = async () => true
}

const { SkillResult, ToolCall } = require('./types')

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let terminalProcess: ChildProcess | null = null
let streamCounter = 0
const activeStreams = new Map<string, any>()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    backgroundColor: '#0a0a0f',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    browserController?.close()
    if (terminalProcess) terminalProcess.kill()
    mainWindow = null
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC - App Info
ipcMain.handle('get-app-version', () => app.getVersion())
ipcMain.handle('get-platform', () => process.platform)
ipcMain.handle('get-user-data-path', () => app.getPath('userData'))

// IPC - API Proxy (fixes CORS)
ipcMain.handle('api:chat', async (_event, { baseUrl, apiKey, body, stream, providerType }) => {
  // Route to provider-specific handlers
  if (providerType === 'anthropic') {
    return handleAnthropicChat(apiKey, body, stream)
  }
  if (providerType === 'bedrock') {
    return handleBedrockChat(apiKey, body, stream)
  }
  return handleOpenAICompatibleChat(baseUrl, apiKey, body, stream)
})

async function handleOpenAICompatibleChat(baseUrl: string, apiKey: string, body: string, stream: boolean) {
  try {
    console.log(`[IPC] api:chat called stream=${stream}`)
    const url = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    })
    console.log(`[IPC] fetch response status=${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.log(`[IPC] fetch error: ${response.status} - ${errorText}`)
      if (response.status === 400) {
        console.log(`[IPC] fetch error: ${response.status} - ${errorText}`)
      }
      return { success: false, error: `${response.status} - ${errorText}` }
    }

    if (!stream) {
      const data: any = await response.json()
      console.log(`[IPC] non-streaming response received`)
      return { success: true, content: data.choices?.[0]?.message?.content || '' }
    }

    // Streaming: create a stream ID and forward chunks to renderer
    const streamId = `stream-${++streamCounter}`
    console.log(`[IPC] streaming streamId=${streamId}`)

    if (!response.body) {
      console.log(`[IPC] no response body`)
      return { success: false, error: 'No response body' }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let isProcessing = false

    const processStream = async () => {
      if (isProcessing) return
      isProcessing = true
      console.log(`[IPC] processStream started for ${streamId}`)
      try {
        while (true) {
          const { done, value } = await reader.read()
          console.log(`[IPC] reader.read() done=${done} valueLen=${value?.length || 0}`)
          if (done) {
            console.log(`[IPC] stream done (reader exhausted) for ${streamId}`)
            mainWindow?.webContents.send('api:stream-data', { streamId, done: true })
            activeStreams.delete(streamId)
            break
          }

          buffer += decoder.decode(value, { stream: true })
          console.log(`[IPC] buffer now ${buffer.length} chars`)

          while (true) {
            const newlineIndex = buffer.indexOf('\n')
            if (newlineIndex === -1) break

            const line = buffer.slice(0, newlineIndex).trim()
            buffer = buffer.slice(newlineIndex + 1)
            console.log(`[IPC] sse line: ${line.slice(0, 80)}...`)

            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                console.log(`[IPC] [DONE] received for ${streamId}`)
                mainWindow?.webContents.send('api:stream-data', { streamId, done: true })
                activeStreams.delete(streamId)
                return
              }
              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices?.[0]?.delta
                const content = delta?.content || ''
                const thinking = delta?.thinking || ''
                console.log(`[IPC] delta content="${content.slice(0, 50)}" thinking=${!!thinking}`)

                if (content || thinking) {
                  console.log(`[IPC] SENDING chunk to renderer for ${streamId}`)
                  mainWindow?.webContents.send('api:stream-data', {
                    streamId,
                    chunk: line + '\n',
                  })
                }
              } catch {
                console.log(`[IPC] failed to parse SSE JSON`)
              }
            }
          }
        }
      } catch (error) {
        console.log(`[IPC] stream error for ${streamId}: ${error instanceof Error ? error.message : error}`)
        mainWindow?.webContents.send('api:stream-data', {
          streamId,
          error: error instanceof Error ? error.message : 'Stream error',
        })
        activeStreams.delete(streamId)
      }
      console.log(`[IPC] processStream finished for ${streamId}`)
    }

    // Store stream data but don't start processing yet (renderer must signal ready first)
    activeStreams.set(streamId, { abort: () => reader.cancel(), start: processStream })
    console.log(`[IPC] api:chat returning success for ${streamId}`)
    return { success: true, streamId }
  } catch (error) {
    console.log(`[IPC] api:chat error: ${error instanceof Error ? error.message : error}`)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Anthropic API handler
async function handleAnthropicChat(apiKey: string, body: string, stream: boolean) {
  try {
    const parsed = JSON.parse(body)
    console.log(`[IPC] anthropic chat stream=${stream} model=${parsed.model}`)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: parsed.model,
        messages: parsed.messages,
        system: parsed.system,
        max_tokens: parsed.max_tokens || 4096,
        stream,
        ...(parsed.temperature !== undefined ? { temperature: parsed.temperature } : {}),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `${response.status} - ${errorText}` }
    }

    if (!stream) {
      const data: any = await response.json()
      const content = data.content?.map((c: any) => c.text || '').join('') || ''
      return { success: true, content }
    }

    // Streaming via SSE
    const streamId = `stream-${++streamCounter}`
    if (!response.body) {
      return { success: false, error: 'No response body' }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let isProcessing = false

    const processStream = async () => {
      if (isProcessing) return
      isProcessing = true
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            mainWindow?.webContents.send('api:stream-data', { streamId, done: true })
            activeStreams.delete(streamId)
            break
          }
          buffer += decoder.decode(value, { stream: true })
          while (true) {
            const newlineIndex = buffer.indexOf('\n')
            if (newlineIndex === -1) break
            const line = buffer.slice(0, newlineIndex).trim()
            buffer = buffer.slice(newlineIndex + 1)
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              // Anthropic SSE format: each event is a JSON object with type
              try {
                const parsed = JSON.parse(data)
                // Convert to OpenAI-compatible SSE format for renderer compatibility
                let chunk = ''
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: parsed.delta.text } }] })}\n`
                } else if (parsed.type === 'message_stop') {
                  chunk = 'data: [DONE]\n'
                }
                if (chunk) {
                  mainWindow?.webContents.send('api:stream-data', { streamId, chunk })
                }
              } catch {
                // skip unparseable lines
              }
            }
          }
        }
      } catch (error) {
        mainWindow?.webContents.send('api:stream-data', { streamId, error: error instanceof Error ? error.message : 'Stream error' })
        activeStreams.delete(streamId)
      }
    }

    activeStreams.set(streamId, { abort: () => reader.cancel(), start: processStream })
    return { success: true, streamId }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Bedrock API handler (placeholder - requires AWS SDK)
async function handleBedrockChat(_apiKey: string, _body: string, _stream: boolean) {
  return {
    success: false,
    error: 'Bedrock provider requires AWS credentials. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION environment variables.',
  }
}

// Renderer calls this AFTER registering its stream listener, guaranteeing no lost events
ipcMain.handle('api:start-stream', async (_event, streamId) => {
  console.log(`[IPC] api:start-stream called for ${streamId}`)
  const stream = activeStreams.get(streamId)
  if (!stream) {
    console.log(`[IPC] api:start-stream - stream not found ${streamId}`)
    return { success: false, error: 'Stream not found or already started' }
  }
  stream.start()
  console.log(`[IPC] api:start-stream started processing for ${streamId}`)
  return { success: true }
})

ipcMain.handle('api:test-provider', async (_event, { baseUrl, apiKey, model }) => {
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (response.ok) {
      const data: any = await response.json()
      const models = data.data?.map((m: any) => m.id) || []
      return { success: true, models }
    }

    const testUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
    const testResponse = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      }),
    })

    if (testResponse.ok) {
      return { success: true, models: [model] }
    }

    const errorText = await testResponse.text()
    return { success: false, error: `Connection failed: ${testResponse.status} - ${errorText}` }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})

ipcMain.handle('api:abort-stream', (_event, streamId: string) => {
  const stream = activeStreams.get(streamId)
  if (stream) {
    stream.abort()
    activeStreams.delete(streamId)
  }
  return { success: true }
})

// IPC - Skills
ipcMain.handle('skills:list', () => {
  return registry.getAll().map((s: any) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    icon: s.icon,
    category: s.category,
    params: s.params,
  }))
})

ipcMain.handle('skills:execute', async (_event, id: string, params: Record<string, any>) => {
  return registry.execute(id, params)
})

// IPC - MCP
ipcMain.handle('mcp:connect', async (_event, config) => mcpClient.connect(config))
ipcMain.handle('mcp:disconnect', async (_event, serverId: string) => {
  await mcpClient.disconnect(serverId)
  return { success: true }
})
ipcMain.handle('mcp:list-tools', async (_event, serverId: string) => mcpClient.listTools(serverId))
ipcMain.handle('mcp:execute', async (_event, serverId: string, toolName: string, params: Record<string, any>) => {
  return mcpClient.executeTool(serverId, toolName, params)
})
ipcMain.handle('mcp:servers', () => mcpClient.getConnectedServers())

// IPC - Computer Control
ipcMain.handle('computer:screenshot', async () => {
  const { screen } = await import('@nut-tree-fork/nut-js')
  const screenshot = await screen.grab()
  return screenshot.data.toString('base64')
})

ipcMain.handle('computer:get-screen-size', async () => {
  const { screen } = await import('@nut-tree-fork/nut-js')
  const rect = await screen.grab()
  return { width: rect.width, height: rect.height }
})

// IPC - Terminal
ipcMain.handle('terminal:execute', async (_event, command: string, shellType?: string) => {
  return new Promise((resolve) => {
    if (terminalProcess) terminalProcess.kill()

    const isWindows = process.platform === 'win32'
    let exe: string
    let args: string[]

    if (isWindows) {
      exe = shellType === 'powershell' ? 'powershell.exe' : 'cmd.exe'
      args = shellType === 'powershell'
        ? ['-NoProfile', '-NonInteractive', '-Command', command]
        : ['/c', command]
    } else {
      // macOS / Linux: prefer user's shell, fall back to bash
      const userShell = process.env.SHELL || '/bin/bash'
      exe = shellType === 'zsh' ? '/bin/zsh' : shellType === 'bash' ? '/bin/bash' : userShell
      args = ['-c', command]
    }

    terminalProcess = spawn(exe, args, { cwd: app.getPath('home'), env: process.env })

    let stdout = ''
    let stderr = ''

    terminalProcess.stdout?.on('data', (data) => { stdout += data.toString() })
    terminalProcess.stderr?.on('data', (data) => { stderr += data.toString() })

    terminalProcess.on('close', (code) => {
      terminalProcess = null
      resolve({ success: code === 0, stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code })
    })

    terminalProcess.on('error', (error) => {
      terminalProcess = null
      resolve({ success: false, stdout: '', stderr: error.message, exitCode: -1 })
    })
  })
})

ipcMain.handle('terminal:kill', () => {
  if (terminalProcess) { terminalProcess.kill(); terminalProcess = null }
  return { success: true }
})

// IPC - AI Tool Execution
ipcMain.handle('ai:execute-tool', async (_event, toolName: string, params: Record<string, any>) => {
  const skill = registry.get(toolName)
  if (skill) return registry.execute(toolName, params)

  const servers = mcpClient.getConnectedServers()
  for (const serverId of servers) {
    try {
      const result = await mcpClient.executeTool(serverId, toolName, params)
      if (result.success) return result
    } catch { /* continue */ }
  }

  return { success: false, output: '', error: `Tool "${toolName}" not found` }
})

ipcMain.handle('ai:list-available-tools', () => {
  const skills = registry.getAll().map((s: any) => ({
    id: s.id, name: s.name, description: s.description, params: s.params,
  }))
  return { skills, mcpServers: mcpClient.getConnectedServers(), mcpTools: [] }
})

// IPC - Git
ipcMain.handle('git:status', async (_event, cwd: string) => {
  try {
    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const exec = promisify(execFile)

    const [branch, status, log] = await Promise.all([
      exec('git', ['branch', '--show-current'], { cwd }).catch(() => ({ stdout: 'unknown' })),
      exec('git', ['status', '--short'], { cwd }).catch(() => ({ stdout: '' })),
      exec('git', ['log', '--oneline', '-n', '5'], { cwd }).catch(() => ({ stdout: '' })),
    ])

    return {
      success: true,
      branch: branch.stdout.trim(),
      status: status.stdout.trim(),
      log: log.stdout.trim(),
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Git error' }
  }
})

ipcMain.handle('git:is-repo', async (_event, cwd: string) => {
  try {
    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const exec = promisify(execFile)
    await exec('git', ['rev-parse', '--git-dir'], { cwd })
    return true
  } catch {
    return false
  }
})

// IPC - Claude Code Tools
ipcMain.handle('tools:list', () => {
  return toolDefinitions || []
})

ipcMain.handle('tools:execute', async (_event, toolName: string, params: Record<string, any>, cwd?: string) => {
  const permitted = await checkPermissionFn(toolName, params, mainWindow)
  if (!permitted) {
    return { success: false, output: '', error: `Permission denied for ${toolName}` }
  }

  return executeToolFn(toolName, params, cwd || app.getPath('home'))
})

ipcMain.handle('tools:get-risk', (_event, toolName: string, params: Record<string, any>) => {
  return getRiskLevelFn(toolName, params)
})

// IPC - System Context
ipcMain.handle('context:get-system', async (_event, cwd?: string) => {
  return getSystemContextFn(cwd)
})

ipcMain.handle('context:format-system-prompt', async (_event, cwd?: string) => {
  const ctx = await getSystemContextFn(cwd)
  return formatSystemPromptFn(ctx)
})

ipcMain.handle('context:format-memory', (_event, memories: Array<{ category: string; content: string }>) => {
  return formatMemoryPromptFn(memories)
})

// IPC - Permission System
setupPermissionIPCFn()

ipcMain.handle('permission:check', async (_event, toolName: string, params: Record<string, any>) => {
  return checkPermissionFn(toolName, params, mainWindow)
})

// IPC - Background Agent
ipcMain.handle('agent:get-state', () => backgroundAgent.getAgentState())
ipcMain.handle('agent:add-task', (_event, task: any) => backgroundAgent.addTask(task))
ipcMain.handle('agent:remove-task', (_event, taskId: string) => backgroundAgent.removeTask(taskId))
ipcMain.handle('agent:toggle-task', (_event, taskId: string) => backgroundAgent.toggleTask(taskId))
ipcMain.handle('agent:start', () => backgroundAgent.startAgent())
ipcMain.handle('agent:stop', () => backgroundAgent.stopAgent())

// IPC - File System Bridge
import { readFile, writeFile, readdir } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { glob } from 'glob'

const execAsync = promisify(execFile)

ipcMain.handle('fs:read-file', async (_event, filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Read failed' }
  }
})

ipcMain.handle('fs:write-file', async (_event, filePath: string, content: string) => {
  try {
    await writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Write failed' }
  }
})

ipcMain.handle('fs:execute-command', async (_event, command: string) => {
  try {
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh'
    const shellArgs = process.platform === 'win32' ? ['-NoProfile', '-Command', command] : ['-c', command]
    const { stdout, stderr } = await execAsync(shell, shellArgs, {
      timeout: 30000,
      env: process.env,
    })
    return { success: true, stdout: stdout.trim(), stderr: stderr.trim() }
  } catch (error: any) {
    return { success: false, stdout: error.stdout?.trim() || '', stderr: error.stderr?.trim() || error.message, error: error.message }
  }
})

ipcMain.handle('fs:glob', async (_event, pattern: string, cwd?: string) => {
  try {
    const matches = await glob(pattern, { cwd: cwd || app.getPath('home'), dot: true })
    return { success: true, files: matches }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Glob failed', files: [] }
  }
})

ipcMain.handle('fs:grep', async (_event, pattern: string, include?: string) => {
  try {
    const globPattern = include || '**/*'
    const files = await glob(globPattern, { cwd: app.getPath('home'), nodir: true, ignore: 'node_modules/**' })
    const results: { file: string; line: number; content: string }[] = []
    const regex = new RegExp(pattern, 'i')
    for (const file of files.slice(0, 100)) {
      try {
        const content = await readFile(file, 'utf-8')
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push({ file, line: i + 1, content: lines[i].trim().slice(0, 200) })
          }
        }
      } catch { /* skip unreadable files */ }
    }
    return { success: true, results }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Grep failed', results: [] }
  }
})

ipcMain.handle('fs:web-search', async (_event, query: string, numResults?: number) => {
  try {
    const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-f788322b7dad42d8bb78250df3a10454'
    const limit = numResults || 5

    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        limit,
        scrapeOptions: { formats: ['markdown'] },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `Firecrawl API error: ${response.status} - ${errorText}` }
    }

    const data: any = await response.json()
    const results = (data.data || []).map((item: any) => ({
      title: item.title || '',
      url: item.url || '',
      description: item.description || item.markdown?.slice(0, 300) || '',
      markdown: item.markdown || '',
    }))

    return { success: true, results }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Search failed', results: [] }
  }
})

ipcMain.handle('fs:web-fetch', async (_event, url: string, maxLength?: number) => {
  try {
    const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-f78...0454'
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
      }),
    })

    if (!response.ok) {
      // Fallback: try direct fetch
      try {
        const directResponse = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OpenDesktop/1.0)' },
        })
        const html = await directResponse.text()
        // Simple HTML to text: strip tags
        const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        const truncated = maxLength ? text.slice(0, maxLength) : text.slice(0, 50000)
        return { success: true, content: truncated }
      } catch {
        return { success: false, error: `Failed to fetch URL: ${url}` }
      }
    }

    const data: any = await response.json()
    const content = data.data?.markdown || data.data?.content || ''
    const truncated = maxLength ? content.slice(0, maxLength) : content.slice(0, 50000)
    return { success: true, content: truncated }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Fetch failed' }
  }
})

// Start background agent on ready
app.whenReady().then(() => {
  createWindow()
  backgroundAgent.startAgent()

  systemSkills?.forEach((skill: any) => registry?.register(skill))
  browserSkills?.forEach((skill: any) => registry?.register(skill))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
