import { BrowserWindow, ipcMain } from 'electron'
import { PermissionRequest, getRiskLevel } from './ClaudeCodeTools'

export type PermissionMode = 'auto' | 'ask' | 'manual'

export interface PermissionRule {
  toolName: string
  mode: PermissionMode
  riskThreshold: 'safe' | 'moderate' | 'dangerous'
}

export interface PermissionState {
  mode: PermissionMode
  rules: PermissionRule[]
  pendingRequests: Map<string, { resolve: (allowed: boolean) => void; request: PermissionRequest }>
}

const defaultRules: PermissionRule[] = [
  { toolName: 'FileRead', mode: 'auto', riskThreshold: 'safe' },
  { toolName: 'Glob', mode: 'auto', riskThreshold: 'safe' },
  { toolName: 'Grep', mode: 'auto', riskThreshold: 'safe' },
  { toolName: 'WebFetch', mode: 'auto', riskThreshold: 'safe' },
  { toolName: 'WebSearch', mode: 'auto', riskThreshold: 'safe' },
  { toolName: 'FileWrite', mode: 'ask', riskThreshold: 'moderate' },
  { toolName: 'FileEdit', mode: 'ask', riskThreshold: 'moderate' },
  { toolName: 'Bash', mode: 'ask', riskThreshold: 'moderate' },
  { toolName: 'Task', mode: 'ask', riskThreshold: 'moderate' },
  { toolName: 'TaskStop', mode: 'auto', riskThreshold: 'safe' },
]

const state: PermissionState = {
  mode: 'ask',
  rules: defaultRules,
  pendingRequests: new Map(),
}

export function getPermissionMode(): PermissionMode {
  return state.mode
}

export function setPermissionMode(mode: PermissionMode): void {
  state.mode = mode
}

export function getRule(toolName: string): PermissionRule | undefined {
  return state.rules.find((r) => r.toolName === toolName)
}

export function setRule(toolName: string, mode: PermissionMode, riskThreshold: PermissionRule['riskThreshold']): void {
  const existing = state.rules.findIndex((r) => r.toolName === toolName)
  if (existing >= 0) {
    state.rules[existing] = { toolName, mode, riskThreshold }
  } else {
    state.rules.push({ toolName, mode, riskThreshold })
  }
}

const riskOrder = { safe: 0, moderate: 1, dangerous: 2 }

function isRiskAllowed(risk: PermissionRequest['riskLevel'], threshold: PermissionRule['riskThreshold']): boolean {
  return riskOrder[risk] <= riskOrder[threshold]
}

export async function checkPermission(
  toolName: string,
  params: Record<string, any>,
  mainWindow: BrowserWindow | null
): Promise<boolean> {
  const riskLevel = getRiskLevel(toolName, params)
  const rule = getRule(toolName)

  if (!rule) {
    return state.mode === 'auto'
  }

  switch (rule.mode) {
    case 'auto':
      return isRiskAllowed(riskLevel, rule.riskThreshold)

    case 'manual':
      return false

    case 'ask':
      if (isRiskAllowed(riskLevel, rule.riskThreshold) && state.mode === 'auto') {
        return true
      }

      return requestPermission(toolName, params, riskLevel, mainWindow)

    default:
      return false
  }
}

function requestPermission(
  toolName: string,
  params: Record<string, any>,
  riskLevel: PermissionRequest['riskLevel'],
  mainWindow: BrowserWindow | null
): Promise<boolean> {
  return new Promise((resolve) => {
    const requestId = `perm-${Date.now()}-${Math.random().toString(36).slice(2)}`

    state.pendingRequests.set(requestId, {
      resolve,
      request: { toolName, params, riskLevel },
    })

    mainWindow?.webContents.send('permission:request', {
      requestId,
      toolName,
      params,
      riskLevel,
    })
  })
}

export function respondToPermission(requestId: string, allowed: boolean): void {
  const pending = state.pendingRequests.get(requestId)
  if (pending) {
    pending.resolve(allowed)
    state.pendingRequests.delete(requestId)
  }
}

export function setupPermissionIPC(): void {
  ipcMain.handle('permission:respond', (_event, requestId: string, allowed: boolean) => {
    respondToPermission(requestId, allowed)
    return { success: true }
  })

  ipcMain.handle('permission:get-mode', () => state.mode)
  ipcMain.handle('permission:set-mode', (_event, mode: PermissionMode) => {
    state.mode = mode
    return { success: true }
  })

  ipcMain.handle('permission:get-rules', () => state.rules)
  ipcMain.handle('permission:set-rule', (_event, toolName: string, mode: PermissionMode, riskThreshold: PermissionRule['riskThreshold']) => {
    setRule(toolName, mode, riskThreshold)
    return { success: true }
  })
}
