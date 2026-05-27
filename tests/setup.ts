import { vi } from 'vitest'

if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.randomUUID) {
  ;(globalThis as any).crypto = {
    ...((globalThis as any).crypto ?? {}),
    randomUUID: vi.fn(() => '00000000-0000-4000-8000-000000000001'),
  }
}

const store: Record<string, string> = {}
;;(globalThis as any).localStorage ??= {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
  get length() { return Object.keys(store).length },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
}

type MockFn = ReturnType<typeof vi.fn>
const mockApiFns: Record<string, MockFn> = {}
const electron = {
  api: {
    chat: vi.fn(),
    testProvider: vi.fn(),
    onStreamData: vi.fn(),
    offStreamData: vi.fn(),
  },
  getUserDataPath: vi.fn(),
  tools: { list: vi.fn(), execute: vi.fn() },
  skills: { list: vi.fn(), execute: vi.fn() },
  terminal: { execute: vi.fn(), kill: vi.fn() },
  computer: { screenshot: vi.fn(), getScreenSize: vi.fn() },
  context: { getSystem: vi.fn(), formatSystemPrompt: vi.fn() },
  git: { status: vi.fn(), isRepo: vi.fn() },
  mcp: { connect: vi.fn(), disconnect: vi.fn(), listTools: vi.fn(), execute: vi.fn(), servers: vi.fn() },
  permission: { check: vi.fn() },
  agent: { getState: vi.fn() },
}

;;(globalThis as any).window ??= {}
;;(globalThis as any).window.electron = electron
;;(globalThis as any).window.api = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  executeCommand: vi.fn(),
  glob: vi.fn(),
  grep: vi.fn(),
  webSearch: vi.fn(),
}