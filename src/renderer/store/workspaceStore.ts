import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Message, Conversation } from '../types'
import { Session, Project, WorkspaceState } from '../types/workspace'

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

const createDefaultSession = (): Session => ({
  id: generateId(),
  name: 'Session 1',
  conversations: [],
  activeConversationId: null,
  messages: [],
  providerId: null,
  mode: 'chat',
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

interface WorkspaceStore extends WorkspaceState {
  // Sessions
  addSession: () => string
  removeSession: (id: string) => void
  switchSession: (id: string) => void
  renameSession: (id: string, name: string) => void
  setActiveSessionMessages: (id: string, messages: Message[]) => void
  setActiveSessionConversations: (id: string, conversations: Conversation[]) => void
  setActiveSessionProvider: (id: string, providerId: string | null) => void
  setActiveSessionMode: (id: string, mode: Session['mode']) => void

  // Projects
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void
  removeProject: (id: string) => void
  switchProject: (id: string) => void
  renameProject: (id: string, name: string) => void

  // Layout
  setLayout: (layout: WorkspaceState['layout']) => void
  togglePinSession: (id: string) => void
  reorderSessions: (fromIndex: number, toIndex: number) => void
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => {
      const defaultSession = createDefaultSession()

      return {
        sessions: [defaultSession],
        activeSessionId: defaultSession.id,
        projects: [],
        activeProjectId: null,
        layout: 'single',
        pinnedSessions: [],

        addSession: () => {
          const session = createDefaultSession()
          session.name = `Session ${session.id.slice(0, 4)}`
          set((state) => ({
            sessions: [...state.sessions, session],
            activeSessionId: session.id,
          }))
          // Reset chat state for new session
          import('../store/chatStore').then(({ useChatStore }) => {
            useChatStore.setState({
              messages: [],
              conversations: [],
              activeConversationId: null,
            })
          })
          return session.id
        },

        removeSession: (id) => {
          set((state) => {
            const remaining = state.sessions.filter((s) => s.id !== id)
            if (remaining.length === 0) {
              const newSession = createDefaultSession()
              return {
                sessions: [newSession],
                activeSessionId: newSession.id,
                pinnedSessions: state.pinnedSessions.filter((p) => p !== id),
              }
            }
            return {
              sessions: remaining,
              activeSessionId: state.activeSessionId === id ? remaining[0].id : state.activeSessionId,
              pinnedSessions: state.pinnedSessions.filter((p) => p !== id),
            }
          })
        },

        switchSession: (id) =>
          set((state) => {
            // Save current session messages
            let updatedSessions = state.sessions
            if (state.activeSessionId) {
              const chatState = (() => {
                try {
                  const store = (window as any).__ZUSTAND_STORE__?.chatStore
                  return store?.getState?.() ?? { messages: [], conversations: [], activeProviderId: null, settings: { mode: 'chat' } }
                } catch { return { messages: [], conversations: [], activeProviderId: null, settings: { mode: 'chat' } } }
              })()
              updatedSessions = state.sessions.map((s) =>
                s.id === state.activeSessionId
                  ? { ...s, messages: chatState.messages, conversations: chatState.conversations, providerId: chatState.activeProviderId, mode: chatState.settings.mode, updatedAt: Date.now() }
                  : s
              )
            }
            // Load target session
            const target = updatedSessions.find((s) => s.id === id)
            if (target) {
              import('../store/chatStore').then(({ useChatStore }) => {
                useChatStore.setState({
                  messages: target.messages,
                  conversations: target.conversations,
                  activeConversationId: target.activeConversationId ?? null,
                  activeProviderId: target.providerId,
                })
                if (target.mode) {
                  useChatStore.getState().updateSettings({ mode: target.mode })
                }
              })
            }
            return { sessions: updatedSessions, activeSessionId: id }
          }),

        renameSession: (id, name) =>
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === id ? { ...s, name, updatedAt: Date.now() } : s
            ),
          })),

        setActiveSessionMessages: (id, messages) =>
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === id ? { ...s, messages, updatedAt: Date.now() } : s
            ),
          })),

        setActiveSessionConversations: (id, conversations) =>
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === id
                ? {
                    ...s,
                    conversations,
                    activeConversationId: conversations[0]?.id || null,
                    updatedAt: Date.now(),
                  }
                : s
            ),
          })),

        setActiveSessionProvider: (id, providerId) =>
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === id ? { ...s, providerId, updatedAt: Date.now() } : s
            ),
          })),

        setActiveSessionMode: (id, mode) =>
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === id ? { ...s, mode, updatedAt: Date.now() } : s
            ),
          })),

        addProject: (project) => {
          const newProject = {
            ...project,
            id: generateId(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          set((state) => ({
            projects: [newProject, ...state.projects],
            activeProjectId: newProject.id,
          }))
        },

        removeProject: (id) =>
          set((state) => ({
            projects: state.projects.filter((p) => p.id !== id),
            activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
          })),

        switchProject: (id) => set({ activeProjectId: id }),

        renameProject: (id, name) =>
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === id ? { ...p, name, updatedAt: Date.now() } : p
            ),
          })),

        setLayout: (layout) => set({ layout }),

        togglePinSession: (id) =>
          set((state) => ({
            pinnedSessions: state.pinnedSessions.includes(id)
              ? state.pinnedSessions.filter((p) => p !== id)
              : [...state.pinnedSessions, id],
          })),

        reorderSessions: (fromIndex, toIndex) =>
          set((state) => {
            const newSessions = [...state.sessions]
            const [removed] = newSessions.splice(fromIndex, 1)
            newSessions.splice(toIndex, 0, removed)
            return { sessions: newSessions }
          }),
      }
    },
    {
      name: 'opendesktop-workspace-v1',
      version: 1,
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        layout: state.layout,
        pinnedSessions: state.pinnedSessions,
      }),
    }
  )
)
