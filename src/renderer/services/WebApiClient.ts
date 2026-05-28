// Web API client — use when running in browser mode (no Electron IPC)
// Calls the Express server's REST API endpoints

const API_BASE = typeof window !== 'undefined' && window.location.port === '5173'
  ? 'http://localhost:3456'  // Vite dev server proxies to Express
  : ''  // Production: same origin

export async function webChat(params: {
  baseUrl: string; apiKey: string; body: string; stream: boolean; providerType?: string
}): Promise<any> {
  if (params.providerType === 'anthropic') {
    return webAnthropicChat(params)
  }
  return webOpenAIChat(params)
}

async function webOpenAIChat(params: {
  baseUrl: string; apiKey: string; body: string; stream: boolean
}): Promise<any> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return handleChatResponse(res, params.stream)
}

async function webAnthropicChat(params: {
  apiKey: string; body: string; stream: boolean
}): Promise<any> {
  const res = await fetch(`${API_BASE}/api/anthropic-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return handleChatResponse(res, params.stream)
}

async function handleChatResponse(res: Response, stream: boolean): Promise<any> {
  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: err }
  }
  if (!stream) {
    const data = await res.json()
    return { success: true, content: data.content || '' }
  }
  // Return stream ID for the renderer to consume
  return { success: true, streamId: 'web-stream', _webStream: res.body }
}

export const webApi = {
  readFile: async (filePath: string) => {
    const res = await fetch(`${API_BASE}/api/fs/read`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    })
    const data = await res.json()
    return data.content || ''
  },

  writeFile: async (filePath: string, content: string) => {
    const res = await fetch(`${API_BASE}/api/fs/write`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content }),
    })
    return res.ok
  },

  executeCommand: async (command: string) => {
    const res = await fetch(`${API_BASE}/api/fs/exec`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    })
    const data = await res.json()
    return { stdout: data.stdout || '', stderr: data.stderr || '', exitCode: 0 }
  },

  glob: async (pattern: string, cwd?: string) => {
    const res = await fetch(`${API_BASE}/api/fs/glob`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern, cwd }),
    })
    const data = await res.json()
    return data.files || []
  },

  grep: async (pattern: string, options?: { cwd?: string; glob?: string }) => {
    const res = await fetch(`${API_BASE}/api/fs/grep`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern, cwd: options?.cwd, glob: options?.glob }),
    })
    const data = await res.json()
    return data.results || []
  },

  webSearch: async (query: string, numResults?: number) => {
    const res = await fetch(`${API_BASE}/api/web-search?q=${encodeURIComponent(query)}&n=${numResults || 5}`)
    const data = await res.json()
    return { success: true, results: data.results || [] }
  },

  webFetch: async (url: string, maxLength?: number) => {
    const res = await fetch(`${API_BASE}/api/web-fetch?url=${encodeURIComponent(url)}&max=${maxLength || 50000}`)
    const data = await res.json()
    return { success: true, content: data.content || '' }
  },
}
