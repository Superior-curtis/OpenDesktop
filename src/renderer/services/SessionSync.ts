import { useWorkspaceStore } from '../store/workspaceStore'
import { useChatStore } from '../store/chatStore'
import type { Conversation } from '../types'

export function saveCurrentSession(): void {
  const ws = useWorkspaceStore.getState()
  const chat = useChatStore.getState()
  const currentId = ws.activeSessionId
  if (!currentId) return

  const session = ws.sessions.find((s) => s.id === currentId)
  if (!session) return

  ws.setActiveSessionMessages(currentId, chat.messages)
  ws.setActiveSessionConversations(currentId, chat.conversations)
  ws.setActiveSessionProvider(currentId, chat.activeProviderId)
  ws.setActiveSessionMode(currentId, chat.settings.mode)
}

export function loadSession(sessionId: string): void {
  const ws = useWorkspaceStore.getState()
  const session = ws.sessions.find((s) => s.id === sessionId)
  if (!session) return

  useChatStore.setState({
    messages: session.messages,
    conversations: session.conversations,
    activeConversationId: session.activeConversationId,
  })

  if (session.providerId) {
    useChatStore.setState({ activeProviderId: session.providerId })
  }

  if (session.mode) {
    const { updateSettings } = useChatStore.getState()
    updateSettings({ mode: session.mode })
  }
}

export function syncOnSessionSwitch(): void {
  const ws = useWorkspaceStore.getState()
  const prevId = ws.activeSessionId
  if (prevId) saveCurrentSession()
}

export function syncOnSessionCreate(): void {
  useChatStore.setState({
    messages: [],
    conversations: [{
      id: crypto.randomUUID?.(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode: useChatStore.getState().settings.mode,
      contextTokens: 0,
    } as Conversation],
    activeConversationId: null,
  })
}
