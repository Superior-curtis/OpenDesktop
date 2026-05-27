import { create } from 'zustand'

export type RiskLevel = 'safe' | 'moderate' | 'dangerous'

export interface PendingPermission {
  id: string
  toolName: string
  input: Record<string, any>
  riskLevel: RiskLevel
  description?: string
  timestamp: number
}

interface PermissionStore {
  pending: PendingPermission[]
}

export const usePermissionStore = create<PermissionStore>(() => ({
  pending: [],
}))

const resolvers = new Map<string, (allowed: boolean) => void>()

export function waitForPermission(req: PendingPermission): Promise<boolean> {
  return new Promise((resolve) => {
    resolvers.set(req.id, resolve)
    usePermissionStore.setState((s) => ({ pending: [...s.pending, req] }))
  })
}

export function resolvePermission(id: string, allowed: boolean): void {
  const resolve = resolvers.get(id)
  if (resolve) {
    resolve(allowed)
    resolvers.delete(id)
    usePermissionStore.setState((s) => ({
      pending: s.pending.filter((r) => r.id !== id),
    }))
  }
}

export function cancelAllPermissions(): void {
  for (const [id, resolve] of resolvers) {
    resolve(false)
    resolvers.delete(id)
  }
  usePermissionStore.setState({ pending: [] })
}

export function getPendingCount(): number {
  return usePermissionStore.getState().pending.length
}
