import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stopped' | 'blocked'

export interface Task {
  id: string
  subject: string
  description: string
  status: TaskStatus
  owner: string | null
  blocks: string[]
  blockedBy: string[]
  createdAt: number
  updatedAt: number
  completedAt: number | null
  output: string | null
  error: string | null
  metadata: Record<string, any>
}

export type AgentStatus = 'idle' | 'running' | 'paused' | 'error'

export interface SubAgent {
  id: string
  name: string
  type: string
  model: string | null
  status: AgentStatus
  currentTaskId: string | null
  createdAt: number
  description: string
}

interface TaskStore {
  tasks: Record<string, Task>
  agents: Record<string, SubAgent>
  activeTaskId: string | null
  viewingTaskId: string | null
  foregroundedTaskId: string | null

  // Task operations
  createTask: (subject: string, description: string, metadata?: Record<string, any>) => string
  getTask: (id: string) => Task | null
  updateTask: (id: string, updates: Partial<Task>) => void
  stopTask: (id: string) => void
  listTasks: (status?: TaskStatus) => Task[]
  getTaskOutput: (id: string) => string | null

  // Agent operations
  createAgent: (name: string, type: string, description: string, model?: string) => string
  getAgent: (id: string) => SubAgent | null
  updateAgent: (id: string, updates: Partial<SubAgent>) => void
  listAgents: () => SubAgent[]

  // Task relationships
  setTaskDependencies: (taskId: string, blocks: string[], blockedBy: string[]) => void

  // UI state
  setActiveTask: (id: string | null) => void
  setViewingTask: (id: string | null) => void
  setForegroundedTask: (id: string | null) => void
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: {},
      agents: {},
      activeTaskId: null,
      viewingTaskId: null,
      foregroundedTaskId: null,

      createTask: (subject, description, metadata) => {
        const id = generateId()
        const task: Task = {
          id,
          subject,
          description,
          status: 'pending',
          owner: null,
          blocks: [],
          blockedBy: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: null,
          output: null,
          error: null,
          metadata: metadata || {},
        }
        set((state) => ({
          tasks: { ...state.tasks, [id]: task },
          activeTaskId: state.activeTaskId || id,
        }))

        // Execute task created hooks
        console.log(`[Task] Created: ${subject} (${id})`)

        return id
      },

      getTask: (id) => get().tasks[id] || null,

      updateTask: (id, updates) => {
        set((state) => {
          const task = state.tasks[id]
          if (!task) return state
          return {
            tasks: {
              ...state.tasks,
              [id]: {
                ...task,
                ...updates,
                updatedAt: Date.now(),
                completedAt: updates.status === 'completed' ? Date.now() : task.completedAt,
              },
            },
          }
        })
      },

      stopTask: (id) => {
        get().updateTask(id, { status: 'stopped' })
      },

      listTasks: (status) => {
        const tasks = Object.values(get().tasks)
        return status ? tasks.filter((t) => t.status === status) : tasks
      },

      getTaskOutput: (id) => get().tasks[id]?.output || null,

      createAgent: (name, type, description, model) => {
        const id = generateId()
        const agent: SubAgent = {
          id,
          name,
          type,
          model: model || null,
          status: 'idle',
          currentTaskId: null,
          createdAt: Date.now(),
          description,
        }
        set((state) => ({
          agents: { ...state.agents, [id]: agent },
        }))
        return id
      },

      getAgent: (id) => get().agents[id] || null,

      updateAgent: (id, updates) => {
        set((state) => {
          const agent = state.agents[id]
          if (!agent) return state
          return {
            agents: { ...state.agents, [id]: { ...agent, ...updates } },
          }
        })
      },

      listAgents: () => Object.values(get().agents),

      setTaskDependencies: (taskId, blocks, blockedBy) => {
        get().updateTask(taskId, { blocks, blockedBy })
      },

      setActiveTask: (id) => set({ activeTaskId: id }),
      setViewingTask: (id) => set({ viewingTaskId: id }),
      setForegroundedTask: (id) => set({ foregroundedTaskId: id }),
    }),
    {
      name: 'opendesktop-tasks-v1',
      version: 1,
      partialize: (state) => ({
        tasks: state.tasks,
        agents: state.agents,
        activeTaskId: state.activeTaskId,
      }),
    }
  )
)
