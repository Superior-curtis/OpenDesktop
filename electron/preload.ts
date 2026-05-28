import { contextBridge, ipcRenderer } from 'electron'

const streamListenerMap = new Map<Function, Function>()

contextBridge.exposeInMainWorld('electron', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),

  // API Proxy (fixes CORS)
  api: {
    chat: (params: { baseUrl: string; apiKey: string; body: string; stream: boolean; providerType?: string }) => ipcRenderer.invoke('api:chat', params),
    testProvider: (params: any) => ipcRenderer.invoke('api:test-provider', params),
    abortStream: (streamId: string) => ipcRenderer.invoke('api:abort-stream', streamId),
    startStream: (streamId: string) => ipcRenderer.invoke('api:start-stream', streamId),
    onStreamData: (callback: (data: any) => void) => {
      const wrapper = (_event: any, data: any) => callback(data)
      streamListenerMap.set(callback, wrapper)
      ipcRenderer.on('api:stream-data', wrapper)
    },
    offStreamData: (callback: (data: any) => void) => {
      const wrapper = streamListenerMap.get(callback)
      if (wrapper) {
        ipcRenderer.removeListener('api:stream-data', wrapper as any)
        streamListenerMap.delete(callback)
      }
    },
  },

  // Skills
  skills: {
    list: () => ipcRenderer.invoke('skills:list'),
    execute: (id: string, params: Record<string, any>) =>
      ipcRenderer.invoke('skills:execute', id, params),
  },

  // MCP
  mcp: {
    connect: (config: any) => ipcRenderer.invoke('mcp:connect', config),
    disconnect: (serverId: string) => ipcRenderer.invoke('mcp:disconnect', serverId),
    listTools: (serverId: string) => ipcRenderer.invoke('mcp:list-tools', serverId),
    execute: (serverId: string, toolName: string, params: Record<string, any>) =>
      ipcRenderer.invoke('mcp:execute', serverId, toolName, params),
    servers: () => ipcRenderer.invoke('mcp:servers'),
  },

  // Computer Control
  computer: {
    screenshot: () => ipcRenderer.invoke('computer:screenshot'),
    getScreenSize: () => ipcRenderer.invoke('computer:get-screen-size'),
  },

  // Terminal
  terminal: {
    execute: (command: string, shell: string) =>
      ipcRenderer.invoke('terminal:execute', command, shell),
    kill: () => ipcRenderer.invoke('terminal:kill'),
  },

  // AI Tool Execution
  ai: {
    executeTool: (toolName: string, params: Record<string, any>) =>
      ipcRenderer.invoke('ai:execute-tool', toolName, params),
    listAvailableTools: () => ipcRenderer.invoke('ai:list-available-tools'),
  },

  // Git
  git: {
    status: (cwd: string) => ipcRenderer.invoke('git:status', cwd),
    isRepo: (cwd: string) => ipcRenderer.invoke('git:is-repo', cwd),
  },

  // Claude Code Tools
  tools: {
    list: () => ipcRenderer.invoke('tools:list'),
    execute: (toolName: string, params: Record<string, any>, cwd?: string) =>
      ipcRenderer.invoke('tools:execute', toolName, params, cwd),
    getRisk: (toolName: string, params: Record<string, any>) =>
      ipcRenderer.invoke('tools:get-risk', toolName, params),
  },

  // System Context
  context: {
    getSystem: (cwd?: string) => ipcRenderer.invoke('context:get-system', cwd),
    formatSystemPrompt: (cwd?: string) => ipcRenderer.invoke('context:format-system-prompt', cwd),
    formatMemory: (memories: Array<{ category: string; content: string }>) =>
      ipcRenderer.invoke('context:format-memory', memories),
  },

  // Permission System
  permission: {
    respond: (requestId: string, allowed: boolean) =>
      ipcRenderer.invoke('permission:respond', requestId, allowed),
    getMode: () => ipcRenderer.invoke('permission:get-mode'),
    setMode: (mode: string) => ipcRenderer.invoke('permission:set-mode', mode),
    getRules: () => ipcRenderer.invoke('permission:get-rules'),
    setRule: (toolName: string, mode: string, riskThreshold: string) =>
      ipcRenderer.invoke('permission:set-rule', toolName, mode, riskThreshold),
    check: (toolName: string, params: Record<string, any>) =>
      ipcRenderer.invoke('permission:check', toolName, params),
    onRequest: (callback: (data: any) => void) => {
      ipcRenderer.on('permission:request', (_event, data) => callback(data))
    },
    offRequest: (callback: (data: any) => void) => {
      ipcRenderer.removeListener('permission:request', callback)
    },
  },

  // Background Agent
  agent: {
    getState: () => ipcRenderer.invoke('agent:get-state'),
    addTask: (task: any) => ipcRenderer.invoke('agent:add-task', task),
    removeTask: (taskId: string) => ipcRenderer.invoke('agent:remove-task', taskId),
    toggleTask: (taskId: string) => ipcRenderer.invoke('agent:toggle-task', taskId),
    start: () => ipcRenderer.invoke('agent:start'),
    stop: () => ipcRenderer.invoke('agent:stop'),
  },

  // File system bridge (window.api)
  readFile: (filePath: string) => ipcRenderer.invoke('fs:read-file', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('fs:write-file', filePath, content),
  executeCommand: (command: string) => ipcRenderer.invoke('fs:execute-command', command),
  glob: (pattern: string, cwd?: string) => ipcRenderer.invoke('fs:glob', pattern, cwd),
  grep: (pattern: string, options?: { cwd?: string; path?: string; glob?: string; output_mode?: string }) =>
    ipcRenderer.invoke('fs:grep', pattern, options?.glob, options?.cwd),
  webSearch: (query: string, numResults?: number) => ipcRenderer.invoke('fs:web-search', query, numResults),
  webFetch: (url: string, maxLength?: number) => ipcRenderer.invoke('fs:web-fetch', url, maxLength),
})

contextBridge.exposeInMainWorld('api', {
  readFile: (filePath: string) => ipcRenderer.invoke('fs:read-file', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('fs:write-file', filePath, content),
  executeCommand: (command: string) => ipcRenderer.invoke('fs:execute-command', command),
  glob: (pattern: string, cwd?: string) => ipcRenderer.invoke('fs:glob', pattern, cwd),
  grep: (pattern: string, options?: { cwd?: string; path?: string; glob?: string; output_mode?: string }) =>
    ipcRenderer.invoke('fs:grep', pattern, options?.glob, options?.cwd),
  webSearch: (query: string, numResults?: number) => ipcRenderer.invoke('fs:web-search', query, numResults),
  webFetch: (url: string, maxLength?: number) => ipcRenderer.invoke('fs:web-fetch', url, maxLength),
})

export interface ElectronAPI {
  getAppVersion: () => Promise<string>
  getPlatform: () => Promise<string>
  getUserDataPath: () => Promise<string>
  api: {
    chat: (params: { baseUrl: string; apiKey: string; body: string; stream: boolean; providerType?: string }) => Promise<any>
    testProvider: (params: any) => Promise<any>
    abortStream: (streamId: string) => Promise<any>
    startStream: (streamId: string) => Promise<any>
    onStreamData: (callback: (data: any) => void) => void
    offStreamData: (callback: (data: any) => void) => void
  }
  skills: {
    list: () => Promise<any[]>
    execute: (id: string, params: Record<string, any>) => Promise<any>
  }
  mcp: {
    connect: (config: any) => Promise<any>
    disconnect: (serverId: string) => Promise<any>
    listTools: (serverId: string) => Promise<any>
    execute: (serverId: string, toolName: string, params: Record<string, any>) => Promise<any>
    servers: () => Promise<string[]>
  }
  computer: {
    screenshot: () => Promise<string>
    getScreenSize: () => Promise<any>
  }
  terminal: {
    execute: (command: string, shell: string) => Promise<any>
    kill: () => Promise<any>
  }
  ai: {
    executeTool: (toolName: string, params: Record<string, any>) => Promise<any>
    listAvailableTools: () => Promise<any>
  }
  git: {
    status: (cwd: string) => Promise<any>
    isRepo: (cwd: string) => Promise<boolean>
  }
  tools: {
    list: () => Promise<any[]>
    execute: (toolName: string, params: Record<string, any>, cwd?: string) => Promise<any>
    getRisk: (toolName: string, params: Record<string, any>) => Promise<string>
  }
  context: {
    getSystem: (cwd?: string) => Promise<any>
    formatSystemPrompt: (cwd?: string) => Promise<string>
    formatMemory: (memories: Array<{ category: string; content: string }>) => Promise<string>
  }
  permission: {
    respond: (requestId: string, allowed: boolean) => Promise<any>
    getMode: () => Promise<string>
    setMode: (mode: string) => Promise<any>
    getRules: () => Promise<any[]>
    setRule: (toolName: string, mode: string, riskThreshold: string) => Promise<any>
    check: (toolName: string, params: Record<string, any>) => Promise<boolean>
    onRequest: (callback: (data: any) => void) => void
    offRequest: (callback: (data: any) => void) => void
  }
  agent: {
    getState: () => Promise<any>
    addTask: (task: any) => Promise<any>
    removeTask: (taskId: string) => Promise<any>
    toggleTask: (taskId: string) => Promise<any>
    start: () => Promise<any>
    stop: () => Promise<any>
  }
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  executeCommand: (command: string) => Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }>
  glob: (pattern: string, cwd?: string) => Promise<{ success: boolean; files?: string[]; error?: string }>
  grep: (pattern: string, include?: string) => Promise<{ success: boolean; results?: { file: string; line: number; content: string }[]; error?: string }>
  webSearch: (query: string, numResults?: number) => Promise<{ success: boolean; results?: { title: string; url: string; description: string; markdown: string }[]; error?: string }>
}

export interface FileSystemAPI {
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  executeCommand: (command: string) => Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }>
  glob: (pattern: string, cwd?: string) => Promise<{ success: boolean; files?: string[]; error?: string }>
  grep: (pattern: string, include?: string) => Promise<{ success: boolean; results?: { file: string; line: number; content: string }[]; error?: string }>
  webSearch: (query: string, numResults?: number) => Promise<{ success: boolean; results?: { title: string; url: string; description: string; markdown: string }[]; error?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: FileSystemAPI
  }
}
