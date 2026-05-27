import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type MemoryType = 'user_pref' | 'fact' | 'context' | 'note'

export interface MemoryEntry {
  id: string
  key: string
  value: string
  type: MemoryType
  createdAt: number
  updatedAt: number
}

interface MemoryStore {
  memories: Record<string, MemoryEntry>
  addMemory: (key: string, value: string, type?: MemoryType) => string
  getMemory: (key: string) => MemoryEntry | null
  listMemories: (type?: MemoryType) => MemoryEntry[]
  removeMemory: (id: string) => void
  clearMemories: () => void
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      memories: {},

      addMemory: (key, value, type = 'note') => {
        const existing = Object.values(get().memories).find(m => m.key === key)
        const now = Date.now()
        if (existing) {
          set((state) => ({
            memories: {
              ...state.memories,
              [existing.id]: { ...existing, value, type, updatedAt: now },
            },
          }))
          return existing.id
        }
        const id = generateId()
        const entry: MemoryEntry = { id, key, value, type, createdAt: now, updatedAt: now }
        set((state) => ({ memories: { ...state.memories, [id]: entry } }))
        return id
      },

      getMemory: (key) => {
        return Object.values(get().memories).find(m => m.key === key) || null
      },

      listMemories: (type) => {
        const all = Object.values(get().memories)
        return type ? all.filter(m => m.type === type) : all
      },

      removeMemory: (id) => {
        set((state) => {
          const { [id]: _, ...rest } = state.memories
          return { memories: rest }
        })
      },

      clearMemories: () => set({ memories: {} }),
    }),
    {
      name: 'opendesktop-memories-v1',
      version: 1,
      partialize: (state) => ({ memories: state.memories }),
    },
  ),
)
