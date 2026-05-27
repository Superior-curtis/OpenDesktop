import { Notification } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execFile)

export interface AgentTask {
  id: string
  name: string
  description: string
  schedule: 'once' | 'daily' | 'weekly' | 'hourly' | 'custom'
  cronExpression?: string
  enabled: boolean
  lastRun?: number
  nextRun?: number
  action: 'notify' | 'execute' | 'webhook' | 'email'
  actionConfig: Record<string, any>
}

export interface AgentState {
  tasks: AgentTask[]
  isRunning: boolean
}

const state: AgentState = {
  tasks: [],
  isRunning: false,
}

const intervals = new Map<string, NodeJS.Timeout>()

export function getAgentState(): AgentState {
  return { ...state }
}

export function addTask(task: AgentTask): AgentTask {
  state.tasks.push(task)
  scheduleTask(task)
  return task
}

export function removeTask(taskId: string): boolean {
  const idx = state.tasks.findIndex((t) => t.id === taskId)
  if (idx === -1) return false
  const task = state.tasks[idx]
  if (intervals.has(task.id)) {
    clearInterval(intervals.get(task.id)!)
    intervals.delete(task.id)
  }
  state.tasks.splice(idx, 1)
  return true
}

export function toggleTask(taskId: string): boolean {
  const task = state.tasks.find((t) => t.id === taskId)
  if (!task) return false
  task.enabled = !task.enabled
  if (task.enabled) {
    scheduleTask(task)
  } else {
    if (intervals.has(task.id)) {
      clearInterval(intervals.get(task.id)!)
      intervals.delete(task.id)
    }
  }
  return true
}

function scheduleTask(task: AgentTask) {
  if (!task.enabled) return

  const getInterval = (): number => {
    switch (task.schedule) {
      case 'hourly': return 60 * 60 * 1000
      case 'daily': return 24 * 60 * 60 * 1000
      case 'weekly': return 7 * 24 * 60 * 60 * 1000
      case 'once': return 5000
      default: return 60 * 60 * 1000
    }
  }

  const runTask = async () => {
    task.lastRun = Date.now()
    task.nextRun = Date.now() + getInterval()

    switch (task.action) {
      case 'notify':
        new Notification({
          title: task.name,
          body: task.description,
          silent: false,
        }).show()
        break

      case 'execute':
        try {
          const result = await exec(task.actionConfig.command || 'echo', [], {
            cwd: task.actionConfig.cwd || process.env.HOME,
          })
          new Notification({
            title: `Task: ${task.name}`,
            body: result.stdout.slice(0, 100) || 'Completed',
          }).show()
        } catch (error) {
          new Notification({
            title: `Task Failed: ${task.name}`,
            body: error instanceof Error ? error.message : 'Unknown error',
          }).show()
        }
        break

      case 'webhook':
        try {
          await fetch(task.actionConfig.url, {
            method: task.actionConfig.method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: task.name, timestamp: new Date().toISOString() }),
          })
        } catch { /* webhook failed silently */ }
        break
    }

    if (task.schedule === 'once') {
      task.enabled = false
      if (intervals.has(task.id)) {
        clearInterval(intervals.get(task.id)!)
        intervals.delete(task.id)
      }
    }
  }

  if (intervals.has(task.id)) {
    clearInterval(intervals.get(task.id)!)
  }

  intervals.set(task.id, setInterval(runTask, getInterval()))
  task.nextRun = Date.now() + getInterval()
}

export function startAgent() {
  state.isRunning = true
  state.tasks.forEach((task) => {
    if (task.enabled) scheduleTask(task)
  })
}

export function stopAgent() {
  state.isRunning = false
  intervals.forEach((interval) => clearInterval(interval))
  intervals.clear()
}
