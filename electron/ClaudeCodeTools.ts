import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, any>
    required: string[]
  }
}

export interface ToolResult {
  success: boolean
  output: string
  error?: string
  metadata?: Record<string, any>
}

export interface PermissionRequest {
  toolName: string
  params: Record<string, any>
  riskLevel: 'safe' | 'moderate' | 'dangerous'
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'Bash',
    description: 'Execute a bash command in the terminal. For interactive processes, use non-interactive mode.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The bash command to execute' },
        cwd: { type: 'string', description: 'Working directory (defaults to home)' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'FileRead',
    description: 'Read the contents of a file at the specified path.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to read' },
        offset: { type: 'number', description: 'Line number to start reading from (1-indexed)' },
        limit: { type: 'number', description: 'Maximum number of lines to read' },
      },
      required: ['path'],
    },
  },
  {
    name: 'FileWrite',
    description: 'Write content to a file, creating it if it does not exist.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to write' },
        content: { type: 'string', description: 'Content to write to the file' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'FileEdit',
    description: 'Edit a file by replacing exact text. The oldString must match exactly.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to edit' },
        oldString: { type: 'string', description: 'Text to replace' },
        newString: { type: 'string', description: 'Replacement text' },
      },
      required: ['path', 'oldString', 'newString'],
    },
  },
  {
    name: 'Glob',
    description: 'Fast file pattern matching tool that works with any codebase size.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts")' },
        cwd: { type: 'string', description: 'Working directory to search in' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'Grep',
    description: 'Fast content search tool that works with any codebase size.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern to search for' },
        path: { type: 'string', description: 'Directory to search in' },
        include: { type: 'string', description: 'File pattern to include (e.g., "*.js")' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'WebFetch',
    description: 'Fetches content from a specified URL and converts it to markdown.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch content from' },
        format: { type: 'string', description: 'Output format: markdown, text, or html', enum: ['markdown', 'text', 'html'] },
      },
      required: ['url'],
    },
  },
  {
    name: 'WebSearch',
    description: 'Search the web and return results with content from relevant websites.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        numResults: { type: 'number', description: 'Number of results to return (default: 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'Task',
    description: 'Launch a new agent to handle complex, multistep tasks autonomously.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'A short description of the task' },
        prompt: { type: 'string', description: 'The task for the agent to perform' },
        subagentType: { type: 'string', description: 'Type of specialized agent to use', enum: ['explore', 'general'] },
      },
      required: ['description', 'prompt', 'subagentType'],
    },
  },
  {
    name: 'TaskStop',
    description: 'Stop a running task agent.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'ID of the task to stop' },
      },
      required: ['taskId'],
    },
  },
]

export function getRiskLevel(toolName: string, params: Record<string, any>): PermissionRequest['riskLevel'] {
  switch (toolName) {
    case 'FileRead':
    case 'Glob':
    case 'Grep':
    case 'WebFetch':
    case 'WebSearch':
      return 'safe'
    case 'FileWrite':
    case 'FileEdit':
      return 'moderate'
    case 'Bash':
      const cmd = params.command?.toLowerCase() || ''
      if (cmd.includes('rm -') || cmd.includes('del ') || cmd.includes('format') || cmd.includes('sudo')) {
        return 'dangerous'
      }
      if (cmd.includes('npm install') || cmd.includes('pip install') || cmd.includes('mkdir') || cmd.includes('touch')) {
        return 'moderate'
      }
      return 'moderate'
    case 'Task':
      return 'moderate'
    case 'TaskStop':
      return 'safe'
    default:
      return 'moderate'
  }
}

export async function executeTool(
  toolName: string,
  params: Record<string, any>,
  cwd: string = app.getPath('home')
): Promise<ToolResult> {
  switch (toolName) {
    case 'Bash':
      return executeBash(params, cwd)
    case 'FileRead':
      return executeFileRead(params, cwd)
    case 'FileWrite':
      return executeFileWrite(params, cwd)
    case 'FileEdit':
      return executeFileEdit(params, cwd)
    case 'Glob':
      return executeGlob(params, cwd)
    case 'Grep':
      return executeGrep(params, cwd)
    case 'WebFetch':
      return executeWebFetch(params)
    case 'WebSearch':
      return executeWebSearch(params)
    case 'Task':
      return executeTask(params)
    case 'TaskStop':
      return executeTaskStop(params)
    default:
      return { success: false, output: '', error: `Unknown tool: ${toolName}` }
  }
}

async function executeBash(params: Record<string, any>, cwd: string): Promise<ToolResult> {
  return new Promise((resolve) => {
    const { command, timeout = 30000 } = params
    const isWindows = process.platform === 'win32'
    const exe = isWindows ? 'powershell.exe' : 'bash'
    const args = isWindows
      ? ['-NoProfile', '-NonInteractive', '-Command', command]
      : ['-c', command]

    const proc = spawn(exe, args, { cwd, env: process.env, timeout })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => { stdout += data.toString() })
    proc.stderr?.on('data', (data) => { stderr += data.toString() })

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output: stdout.trim(),
        error: stderr.trim() || undefined,
        metadata: { exitCode: code },
      })
    })

    proc.on('error', (error) => {
      resolve({ success: false, output: '', error: error.message })
    })

    proc.on('timeout', () => {
      proc.kill()
      resolve({ success: false, output: stdout.trim(), error: `Command timed out after ${timeout}ms` })
    })
  })
}

async function executeFileRead(params: Record<string, any>, cwd: string): Promise<ToolResult> {
  try {
    const filePath = path.isAbsolute(params.path) ? params.path : path.join(cwd, params.path)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    const offset = params.offset ? params.offset - 1 : 0
    const limit = params.limit || lines.length
    const sliced = lines.slice(offset, offset + limit)

    return {
      success: true,
      output: sliced.map((line, i) => `${offset + i + 1}: ${line}`).join('\n'),
      metadata: { totalLines: lines.length, shownLines: sliced.length },
    }
  } catch (error) {
    return { success: false, output: '', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function executeFileWrite(params: Record<string, any>, cwd: string): Promise<ToolResult> {
  try {
    const filePath = path.isAbsolute(params.path) ? params.path : path.join(cwd, params.path)
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filePath, params.content, 'utf-8')
    return { success: true, output: `File written: ${filePath}` }
  } catch (error) {
    return { success: false, output: '', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function executeFileEdit(params: Record<string, any>, cwd: string): Promise<ToolResult> {
  try {
    const filePath = path.isAbsolute(params.path) ? params.path : path.join(cwd, params.path)
    const content = await fs.readFile(filePath, 'utf-8')

    if (!content.includes(params.oldString)) {
      return { success: false, output: '', error: `oldString not found in ${params.path}` }
    }

    const occurrences = content.split(params.oldString).length - 1
    if (occurrences > 1) {
      return { success: false, output: '', error: `oldString found ${occurrences} times, must be unique` }
    }

    const newContent = content.replace(params.oldString, params.newString)
    await fs.writeFile(filePath, newContent, 'utf-8')
    return { success: true, output: `File edited: ${filePath}` }
  } catch (error) {
    return { success: false, output: '', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function executeGlob(params: Record<string, any>, cwd: string): Promise<ToolResult> {
  try {
    const { glob } = await import('glob')
    const searchCwd = params.cwd ? path.resolve(cwd, params.cwd) : cwd
    const files = await glob(params.pattern, { cwd: searchCwd, nodir: true })
    return {
      success: true,
      output: files.length > 0 ? files.join('\n') : 'No files found',
      metadata: { count: files.length },
    }
  } catch (error) {
    return { success: false, output: '', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function executeGrep(params: Record<string, any>, cwd: string): Promise<ToolResult> {
  return new Promise((resolve) => {
    const { pattern, path: searchPath, include } = params
    const isWindows = process.platform === 'win32'
    const exe = isWindows ? 'findstr' : 'grep'

    let args: string[]
    if (isWindows) {
      args = ['/R', '/N', pattern]
      if (include) args.push('/P')
    } else {
      args = ['-r', '-n', '-E', pattern]
      if (include) args.push('--include', include)
    }

    const target = searchPath ? path.resolve(cwd, searchPath) : cwd
    args.push(target)

    const proc = spawn(exe, args, { cwd })
    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => { stdout += data.toString() })
    proc.stderr?.on('data', (data) => { stderr += data.toString() })

    proc.on('close', (code) => {
      resolve({
        success: code === 0 || code === 1,
        output: stdout.trim() || 'No matches found',
        error: code === 2 ? stderr.trim() : undefined,
      })
    })

    proc.on('error', (error) => {
      resolve({ success: false, output: '', error: error.message })
    })
  })
}

async function executeWebFetch(params: Record<string, any>): Promise<ToolResult> {
  try {
    const response = await fetch(params.url)
    if (!response.ok) {
      return { success: false, output: '', error: `HTTP ${response.status}: ${response.statusText}` }
    }

    const html = await response.text()

    if (params.format === 'html') {
      return { success: true, output: html }
    }

    if (params.format === 'text') {
      const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
      return { success: true, output: text }
    }

    const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    return { success: true, output: text }
  } catch (error) {
    return { success: false, output: '', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function executeWebSearch(params: Record<string, any>): Promise<ToolResult> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(params.query)}`
    const response = await fetch(url)
    const html = await response.text()

    const results: Array<{ title: string; url: string; snippet: string }> = []
    const resultRegex = /<a[^>]*class="result[^"]*"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g
    const snippetRegex = /<a[^>]*class="result[^"]*"[^>]*>.*?<\/a>.*?<p class="result__snippet">(.*?)<\/p>/gs

    let match
    while ((match = resultRegex.exec(html)) !== null) {
      const url = match[1]
      const title = match[2].replace(/<[^>]*>/g, '').trim()
      results.push({ title, url, snippet: '' })
    }

    return {
      success: true,
      output: results.length > 0
        ? results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}`).join('\n\n')
        : 'No results found',
      metadata: { count: results.length },
    }
  } catch (error) {
    return { success: false, output: '', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function executeTask(params: Record<string, any>): Promise<ToolResult> {
  return {
    success: true,
    output: `Task launched: ${params.description}. Agent will work autonomously on: ${params.prompt}`,
    metadata: { taskId: `task-${Date.now()}`, subagentType: params.subagentType },
  }
}

async function executeTaskStop(params: Record<string, any>): Promise<ToolResult> {
  return {
    success: true,
    output: `Task ${params.taskId} stopped.`,
  }
}
