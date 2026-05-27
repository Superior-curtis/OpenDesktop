const IPC_TIMEOUT = 30000
const RETRY_DELAY = 1000
const MAX_RETRIES = 3

export class IpcError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: unknown,
  ) {
    super(message)
    this.name = 'IpcError'
  }
}

function getElectron(): typeof window.electron | null {
  try {
    return (window as any).electron ?? null
  } catch {
    return null
  }
}

export function electronAvailable(): boolean {
  return getElectron() !== null
}

export async function ipcCall<T>(
  fn: () => Promise<T>,
  options?: { timeout?: number; retries?: number; label?: string },
): Promise<T> {
  const timeout = options?.timeout ?? IPC_TIMEOUT
  const maxRetries = options?.retries ?? MAX_RETRIES

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new IpcError(
            `IPC timeout after ${timeout}ms${options?.label ? ` (${options.label})` : ''}`,
            'TIMEOUT',
          )), timeout),
        ),
      ])
      return result
    } catch (err) {
      if (err instanceof IpcError) throw err
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, RETRY_DELAY * (attempt + 1)))
        continue
      }
      throw new IpcError(
        `IPC call failed${options?.label ? ` (${options.label})` : ''}: ${err instanceof Error ? err.message : String(err)}`,
        'FAILED',
        err,
      )
    }
  }
  throw new IpcError('IPC call failed: max retries exceeded', 'RETRY_EXHAUSTED')
}

export const ipc = {
  get chat() {
    const e = getElectron()
    return e?.api?.chat ? (params: any) => ipcCall(() => e.api.chat(params), { label: 'api.chat', timeout: 60000 }) : undefined
  },
  get testProvider() {
    const e = getElectron()
    return e?.api?.testProvider ? (params: any) => ipcCall(() => e.api.testProvider(params), { label: 'api.testProvider' }) : undefined
  },
  get onStreamData() {
    const e = getElectron()
    return e?.api?.onStreamData ? (cb: (data: any) => void) => e.api.onStreamData(cb) : undefined
  },
  get offStreamData() {
    const e = getElectron()
    return e?.api?.offStreamData ? (cb: (data: any) => void) => e.api.offStreamData(cb) : undefined
  },
  get getUserDataPath() {
    const e = getElectron()
    return e?.getUserDataPath ? () => ipcCall(() => e.getUserDataPath(), { label: 'getUserDataPath' }) : undefined
  },
  get tools() {
    const e = getElectron()
    return {
      list: e?.tools?.list ? () => ipcCall(() => e.tools.list(), { label: 'tools.list' }) : undefined,
      execute: e?.tools?.execute ? (toolName: string, params: any, cwd?: string) => ipcCall(() => e.tools.execute(toolName, params, cwd), { label: 'tools.execute' }) : undefined,
    }
  },
  get skills() {
    const e = getElectron()
    return {
      list: e?.skills?.list ? () => ipcCall(() => e.skills.list(), { label: 'skills.list' }) : undefined,
      execute: e?.skills?.execute ? (id: string, params: any) => ipcCall(() => e.skills.execute(id, params), { label: 'skills.execute' }) : undefined,
    }
  },
  get terminal() {
    const e = getElectron()
    return {
      execute: e?.terminal?.execute ? (cmd: string, shell: string) => ipcCall(() => e.terminal.execute(cmd, shell), { label: 'terminal.execute', timeout: 60000 }) : undefined,
      kill: e?.terminal?.kill ? () => ipcCall(() => e.terminal.kill(), { label: 'terminal.kill' }) : undefined,
    }
  },
  get computer() {
    const e = getElectron()
    return {
      screenshot: e?.computer?.screenshot ? () => ipcCall(() => e.computer.screenshot(), { label: 'computer.screenshot', timeout: 15000 }) : undefined,
      getScreenSize: e?.computer?.getScreenSize ? () => ipcCall(() => e.computer.getScreenSize(), { label: 'computer.getScreenSize' }) : undefined,
    }
  },
  get context() {
    const e = getElectron()
    return {
      getSystem: e?.context?.getSystem ? (cwd?: string) => ipcCall(() => e.context.getSystem(cwd), { label: 'context.getSystem' }) : undefined,
      formatSystemPrompt: e?.context?.formatSystemPrompt ? (cwd?: string) => ipcCall(() => e.context.formatSystemPrompt(cwd), { label: 'context.formatSystemPrompt' }) : undefined,
    }
  },
  get git() {
    const e = getElectron()
    return {
      status: e?.git?.status ? (cwd: string) => ipcCall(() => e.git.status(cwd), { label: 'git.status' }) : undefined,
      isRepo: e?.git?.isRepo ? (cwd: string) => ipcCall(() => e.git.isRepo(cwd), { label: 'git.isRepo' }) : undefined,
    }
  },
  get permission() {
    const e = getElectron()
    return e?.permission?.check ? (toolName: string, params: any) => ipcCall(() => e.permission.check(toolName, params), { label: 'permission.check' }) : undefined
  },
  get mcp() {
    const e = getElectron()
    return {
      connect: e?.mcp?.connect ? (config: any) => ipcCall(() => e.mcp.connect(config), { label: 'mcp.connect', timeout: 15000 }) : undefined,
      disconnect: e?.mcp?.disconnect ? (serverId: string) => ipcCall(() => e.mcp.disconnect(serverId), { label: 'mcp.disconnect' }) : undefined,
      listTools: e?.mcp?.listTools ? (serverId: string) => ipcCall(() => e.mcp.listTools(serverId), { label: 'mcp.listTools' }) : undefined,
      execute: e?.mcp?.execute ? (serverId: string, toolName: string, params: any) => ipcCall(() => e.mcp.execute(serverId, toolName, params), { label: 'mcp.execute', timeout: 60000 }) : undefined,
      servers: e?.mcp?.servers ? () => ipcCall(() => e.mcp.servers(), { label: 'mcp.servers' }) : undefined,
    }
  },
  get agent() {
    const e = getElectron()
    return e?.agent?.getState ? () => ipcCall(() => e.agent.getState(), { label: 'agent.getState' }) : undefined
  },
}

export async function safeIpcCall<T>(
  fallback: T,
  fn: () => Promise<T>,
  options?: { timeout?: number; retries?: number; label?: string },
): Promise<T> {
  try {
    return await ipcCall(fn, options)
  } catch {
    return fallback
  }
}