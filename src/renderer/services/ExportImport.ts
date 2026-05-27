import { useChatStore } from '../store/chatStore'
import { useWorkspaceStore } from '../store/workspaceStore'

export interface AppExport {
  version: number
  exportedAt: string
  app: string
  chat: {
    messages: ReturnType<typeof useChatStore.getState>['messages']
    providers: ReturnType<typeof useChatStore.getState>['providers']
    activeProviderId: ReturnType<typeof useChatStore.getState>['activeProviderId']
    settings: ReturnType<typeof useChatStore.getState>['settings']
    conversations: ReturnType<typeof useChatStore.getState>['conversations']
    activeConversationId: ReturnType<typeof useChatStore.getState>['activeConversationId']
  }
  workspace: {
    sessions: ReturnType<typeof useWorkspaceStore.getState>['sessions']
    activeSessionId: ReturnType<typeof useWorkspaceStore.getState>['activeSessionId']
    projects: ReturnType<typeof useWorkspaceStore.getState>['projects']
    activeProjectId: ReturnType<typeof useWorkspaceStore.getState>['activeProjectId']
    layout: ReturnType<typeof useWorkspaceStore.getState>['layout']
    pinnedSessions: ReturnType<typeof useWorkspaceStore.getState>['pinnedSessions']
  }
}

export function exportAllData(): string {
  const chat = useChatStore.getState()
  const ws = useWorkspaceStore.getState()
  const payload: AppExport = {
    version: 3,
    exportedAt: new Date().toISOString(),
    app: 'opendesktop',
    chat: {
      messages: chat.messages,
      providers: chat.providers,
      activeProviderId: chat.activeProviderId,
      settings: chat.settings,
      conversations: chat.conversations,
      activeConversationId: chat.activeConversationId,
    },
    workspace: {
      sessions: ws.sessions,
      activeSessionId: ws.activeSessionId,
      projects: ws.projects,
      activeProjectId: ws.activeProjectId,
      layout: ws.layout,
      pinnedSessions: ws.pinnedSessions,
    },
  }
  return JSON.stringify(payload, null, 2)
}

export function importAllData(json: string): { success: boolean; error?: string } {
  try {
    const data = JSON.parse(json)
    if (data.app !== 'opendesktop') return { success: false, error: `Invalid export file: expected "opendesktop", got "${data.app}"` }
    if (typeof data.version !== 'number') return { success: false, error: 'Invalid export version' }

    if (data.chat) {
      const c = data.chat
      useChatStore.setState({
        messages: Array.isArray(c.messages) ? c.messages : [],
        providers: Array.isArray(c.providers) ? c.providers : [],
        activeProviderId: c.activeProviderId ?? null,
        conversations: Array.isArray(c.conversations) ? c.conversations : [],
        activeConversationId: c.activeConversationId ?? null,
      })
      if (c.settings) {
        useChatStore.getState().updateSettings(c.settings)
      }
    }
    if (data.workspace) {
      const w = data.workspace
      useWorkspaceStore.setState({
        sessions: w.sessions ?? [],
        activeSessionId: w.activeSessionId ?? null,
        projects: w.projects ?? [],
        activeProjectId: w.activeProjectId ?? null,
        layout: w.layout ?? 'single',
        pinnedSessions: w.pinnedSessions ?? [],
      })
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to import' }
  }
}

export function downloadExport(data: string, filename = `opendesktop-export-${Date.now()}.json`) {
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function readImportFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { reject(new Error('No file selected')); return }
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    }
    input.click()
  })
}
