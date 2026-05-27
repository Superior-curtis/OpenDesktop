export interface ElectronAPI {
  getAppVersion: () => Promise<string>
  getPlatform: () => Promise<string>
  getUserDataPath: () => Promise<string>
  api: {
    chat: (params: any) => Promise<any>
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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      readFile: (path: string) => Promise<string>
      writeFile: (path: string, content: string) => Promise<void>
      executeCommand: (command: string, options?: any) => Promise<{ stdout: string; stderr: string; exitCode: number }>
      glob: (pattern: string, options?: any) => Promise<string[]>
      grep: (pattern: string, options?: any) => Promise<string[]>
      webSearch: (query: string, numResults?: number) => Promise<any>
      [key: string]: any
    }
  }
}

export {}
