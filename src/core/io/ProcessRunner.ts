export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface ExecOptions {
  args?: string[]
  env?: Record<string, string>
  timeout?: number
  cwd?: string
}

export interface ProcessRunner {
  executeCommand(command: string, options?: ExecOptions): Promise<ExecResult>
  spawn(command: string, args: string[], options?: ExecOptions): { onStdout: (cb: (data: string) => void) => void; onStderr: (cb: (data: string) => void) => void; onExit: (cb: (code: number) => void) => void; kill: () => void }
}
