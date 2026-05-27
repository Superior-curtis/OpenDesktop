import { create } from 'zustand'

export type ViewId = 'chat' | 'settings' | 'advanced-settings' | 'provider-config' | 'skills' | 'tools' | 'agent-config' | 'mcp-servers' | 'shortcuts' | 'search' | 'files'

interface ViewStore {
  currentView: ViewId
  viewHistory: ViewId[]
  navigate: (view: ViewId) => void
  goBack: () => void
}

export const useViewStore = create<ViewStore>((set) => ({
  currentView: 'chat',
  viewHistory: ['chat'],
  navigate: (view) =>
    set((state) => ({
      currentView: view,
      viewHistory: [...state.viewHistory, view],
    })),
  goBack: () =>
    set((state) => {
      if (state.viewHistory.length <= 1) return state
      const newHistory = state.viewHistory.slice(0, -1)
      return { currentView: newHistory[newHistory.length - 1], viewHistory: newHistory }
    }),
}))

export function ViewSwitcher({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function ViewContainer({ view, children }: { view: ViewId; children: React.ReactNode }) {
  const currentView = useViewStore((s) => s.currentView)
  if (currentView !== view) return null
  return <>{children}</>
}