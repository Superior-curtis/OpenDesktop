import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Message, Provider, Settings, Conversation, Memory, MCPConfig, AppState, RichMessage } from '../types'
import type { MessagePart } from '../services/MessageParts'
import { fromSimpleMessage } from '../services/MessageParts'
import { getDefaultThinkingState } from '../services/ThinkingSystem'

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

const defaultSettings: Settings = {
  theme: 'system',
  autoSave: true,
  maxTokens: 4096,
  temperature: 0.7,
  fontSize: 'medium',
  sendShortcut: 'enter',
  mode: 'chat',
  systemPrompt: '',
  memories: [],
  mcpServers: [],
  autoUseMCP: true,
  thinking: getDefaultThinkingState(),
  effort: 'medium',
  outputStyle: 'detailed',
  developerMode: false,
  permissionMode: 'ask',
}

const createInitialConversation = (mode: Settings['mode'] = 'chat'): Conversation => ({
  id: generateId(),
  title: 'New Chat',
  messages: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  mode,
  contextTokens: 0,
})

interface ChatState {
  messages: Message[]
  addMessage: (message: Message) => void
  updateMessage: (id: string, content: string) => void
  clearMessages: () => void
  deleteMessage: (id: string) => void
  replaceMessages: (newMessages: Message[]) => void

  richMessages: RichMessage[]
  addRichMessage: (richMessage: RichMessage) => void
  updateRichMessageParts: (id: string, parts: MessagePart[]) => void

  providers: Provider[]
  activeProviderId: string | null
  addProvider: (provider: Provider) => void
  updateProvider: (id: string, provider: Partial<Provider>) => void
  removeProvider: (id: string) => void
  setActiveProvider: (id: string) => void

  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  isSettingsOpen: boolean
  setIsSettingsOpen: (open: boolean) => void
  error: string | null
  setError: (error: string | null) => void

  conversations: Conversation[]
  activeConversationId: string | null
  createConversation: () => string
  switchConversation: (id: string) => void
  deleteConversation: (id: string) => void
  updateConversationTitle: (id: string, title: string) => void
  syncActiveConversation: () => void

  settings: Settings
  updateSettings: (settings: Partial<Settings>) => void
  addMemory: (memory: Memory) => void
  removeMemory: (id: string) => void
  addMCPServer: (server: MCPConfig) => void
  removeMCPServer: (id: string) => void

  isSidebarOpen: boolean
  setIsSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setMode: (mode: Settings['mode']) => void

  isThinkingPanelOpen: boolean
  setIsThinkingPanelOpen: (open: boolean) => void

  appState: AppState
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => {
      const initialConversation = createInitialConversation(defaultSettings.mode)
      const defaultAppState: AppState = {
        thinking: getDefaultThinkingState(),
        mcpServers: [],
        mcpTools: [],
        memories: [],
        systemContext: {
          currentDate: new Date().toLocaleDateString(),
          os: navigator.platform,
          cwd: '/',
        },
        costTracking: {
          totalTokens: 0,
          totalCost: 0,
          sessionTokens: 0,
        },
      }

      return {
        messages: [],
        addMessage: (message) =>
          set((state) => {
            const newMessages = [...state.messages, message]
            const richMessage = fromSimpleMessage(message)
            const newRich = [...state.richMessages, richMessage]
            const convId = state.activeConversationId
            if (convId) {
              const conversations = state.conversations.map((c) =>
                c.id === convId
                  ? {
                      ...c,
                      messages: newMessages,
                      updatedAt: Date.now(),
                      title:
                        c.title === 'New Chat' && message.role === 'user'
                          ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
                          : c.title,
                    }
                  : c
              )
              return { messages: newMessages, richMessages: newRich, conversations }
            }
            return { messages: newMessages, richMessages: newRich }
          }),
        updateMessage: (id, content) =>
          set((state) => {
            const newMessages = state.messages.map((msg) =>
              msg.id === id ? { ...msg, content } : msg
            )
            const newRich = state.richMessages.map((rm) =>
              rm.id === id ? { ...rm, parts: [{ type: 'text' as const, text: content }] } : rm
            )
            const convId = state.activeConversationId
            if (convId) {
              const conversations = state.conversations.map((c) =>
                c.id === convId ? { ...c, messages: newMessages, updatedAt: Date.now() } : c
              )
              return { messages: newMessages, richMessages: newRich, conversations }
            }
            return { messages: newMessages, richMessages: newRich }
          }),
        clearMessages: () =>
          set((state) => {
            const convId = state.activeConversationId
            if (convId) {
              const conversations = state.conversations.map((c) =>
                c.id === convId ? { ...c, messages: [], updatedAt: Date.now() } : c
              )
              return { messages: [], richMessages: [], conversations, isLoading: false, error: '' }
            }
            return { messages: [], richMessages: [], isLoading: false, error: '' }
          }),
        deleteMessage: (id) =>
          set((state) => {
            const newMessages = state.messages.filter((msg) => msg.id !== id)
            const newRich = state.richMessages.filter((rm) => rm.id !== id)
            const convId = state.activeConversationId
            if (convId) {
              const conversations = state.conversations.map((c) =>
                c.id === convId ? { ...c, messages: newMessages, updatedAt: Date.now() } : c
              )
              return { messages: newMessages, richMessages: newRich, conversations }
            }
            return { messages: newMessages, richMessages: newRich }
          }),
        replaceMessages: (newMessages) =>
          set((state) => {
            const convId = state.activeConversationId
            const newRich = state.richMessages.filter((rm) =>
              newMessages.some((m) => m.id === rm.id),
            )
            if (convId) {
              const conversations = state.conversations.map((c) =>
                c.id === convId ? { ...c, messages: newMessages, updatedAt: Date.now() } : c
              )
              return { messages: newMessages, richMessages: newRich, conversations }
            }
            return { messages: newMessages, richMessages: newRich }
          }),

        richMessages: [],
        addRichMessage: (richMessage) =>
          set((state) => {
            const newRich = [...state.richMessages, richMessage]
            const convId = state.activeConversationId
            if (convId) {
              const conversations = state.conversations.map((c) =>
                c.id === convId ? { ...c, updatedAt: Date.now() } : c
              )
              return { richMessages: newRich, conversations }
            }
            return { richMessages: newRich }
          }),
        updateRichMessageParts: (id, parts) =>
          set((state) => {
            const newRich = state.richMessages.map((rm) =>
              rm.id === id ? { ...rm, parts } : rm
            )
            return { richMessages: newRich }
          }),

        providers: [],
        activeProviderId: null,
        addProvider: (provider) =>
          set((state) => ({
            providers: [...state.providers, provider],
            activeProviderId: state.activeProviderId || provider.id,
          })),
        updateProvider: (id, provider) =>
          set((state) => ({
            providers: state.providers.map((p) =>
              p.id === id ? { ...p, ...provider } : p
            ),
          })),
        removeProvider: (id) =>
          set((state) => {
            const newProviders = state.providers.filter((p) => p.id !== id)
            return {
              providers: newProviders,
              activeProviderId:
                state.activeProviderId === id
                  ? newProviders[0]?.id || null
                  : state.activeProviderId,
            }
          }),
        setActiveProvider: (id) => set({ activeProviderId: id }),

        isLoading: false,
        setIsLoading: (loading) => set({ isLoading: loading }),
        isSettingsOpen: false,
        setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
        error: null,
        setError: (error) => set({ error }),

        conversations: [initialConversation],
        activeConversationId: initialConversation.id,
        createConversation: () => {
          const newConv = createInitialConversation(defaultSettings.mode)
          set((state) => ({
            conversations: [newConv, ...state.conversations],
            activeConversationId: newConv.id,
            messages: [],
          }))
          return newConv.id
        },
        switchConversation: (id) =>
          set((state) => {
            const conv = state.conversations.find((c) => c.id === id)
            if (!conv) return state
            return {
              activeConversationId: id,
              messages: conv.messages,
              activeProviderId: conv.providerId || state.activeProviderId,
            }
          }),
        deleteConversation: (id) =>
          set((state) => {
            const newConvs = state.conversations.filter((c) => c.id !== id)
            if (newConvs.length === 0) {
              const newConv = createInitialConversation(state.settings.mode)
              return {
                conversations: [newConv],
                activeConversationId: newConv.id,
                messages: [],
              }
            }
            if (state.activeConversationId === id) {
              return {
                conversations: newConvs,
                activeConversationId: newConvs[0].id,
                messages: newConvs[0].messages,
              }
            }
            return { conversations: newConvs }
          }),
        updateConversationTitle: (id, title) =>
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, title } : c
            ),
          })),
        syncActiveConversation: () =>
          set((state) => {
            const convId = state.activeConversationId
            if (!convId) return state
            return {
              conversations: state.conversations.map((c) =>
                c.id === convId
                  ? { ...c, messages: state.messages, updatedAt: Date.now() }
                  : c
              ),
            }
          }),

        settings: defaultSettings,
        updateSettings: (newSettings) =>
          set((state) => ({
            settings: { ...state.settings, ...newSettings },
          })),
        addMemory: (memory) =>
          set((state) => ({
            settings: {
              ...state.settings,
              memories: [...state.settings.memories, memory],
            },
          })),
        removeMemory: (id) =>
          set((state) => ({
            settings: {
              ...state.settings,
              memories: state.settings.memories.filter((m) => m.id !== id),
            },
          })),
        addMCPServer: (server) =>
          set((state) => ({
            settings: {
              ...state.settings,
              mcpServers: [...state.settings.mcpServers, server],
            },
          })),
        removeMCPServer: (id) =>
          set((state) => ({
            settings: {
              ...state.settings,
              mcpServers: state.settings.mcpServers.filter((s) => s.id !== id),
            },
          })),

        isSidebarOpen: true,
        setIsSidebarOpen: (open) => set({ isSidebarOpen: open }),
        toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
        setMode: (mode) =>
          set((state) => ({
            settings: { ...state.settings, mode },
          })),

        isThinkingPanelOpen: false,
        setIsThinkingPanelOpen: (open) => set({ isThinkingPanelOpen: open }),

        appState: defaultAppState,
      }
    },
    {
      name: 'opendesktop-storage-v3',
      version: 3,
      partialize: (state) => ({
        messages: state.messages,
        providers: state.providers,
        activeProviderId: state.activeProviderId,
        settings: state.settings,
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        appState: state.appState,
      }),
    }
  )
)
