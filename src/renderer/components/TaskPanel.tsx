import { useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import { X, Plus, Square, Trash2, ChevronDown, ChevronRight, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface TaskPanelProps {
  onClose: () => void
}

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-zinc-400', bg: 'bg-zinc-800' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-900/30' },
  completed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
  failed: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-900/30' },
  stopped: { icon: Square, color: 'text-amber-400', bg: 'bg-amber-900/30' },
  blocked: { icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-900/30' },
}

const AGENT_STATUS_CONFIG = {
  idle: { color: 'text-zinc-500', label: 'Idle' },
  running: { color: 'text-blue-400', label: 'Running' },
  paused: { color: 'text-amber-400', label: 'Paused' },
  error: { color: 'text-red-400', label: 'Error' },
}

export function TaskPanel({ onClose }: TaskPanelProps) {
  const {
    tasks,
    agents,
    activeTaskId,
    createTask,
    stopTask,
    setActiveTask,
    setViewingTask,
    createAgent,
  } = useTaskStore()

  const [showNewTask, setShowNewTask] = useState(false)
  const [showNewAgent, setShowNewAgent] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [newTask, setNewTask] = useState({ subject: '', description: '' })
  const [newAgent, setNewAgent] = useState({ name: '', type: 'general', description: '' })
  const [activeTab, setActiveTab] = useState<'tasks' | 'agents'>('tasks')

  const taskList = Object.values(tasks).sort((a, b) => b.createdAt - a.createdAt)
  const agentList = Object.values(agents)

  const toggleExpand = (id: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreateTask = () => {
    if (!newTask.subject.trim()) return
    createTask(newTask.subject.trim(), newTask.description.trim())
    setNewTask({ subject: '', description: '' })
    setShowNewTask(false)
  }

  const handleCreateAgent = () => {
    if (!newAgent.name.trim()) return
    createAgent(newAgent.name.trim(), newAgent.type, newAgent.description.trim())
    setNewAgent({ name: '', type: 'general', description: '' })
    setShowNewAgent(false)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl overflow-hidden border border-zinc-800" style={{ background: '#18181b' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-100">Tasks & Agents</h2>
            <div className="flex gap-0.5">
              <button
                onClick={() => setActiveTab('tasks')}
                className={`px-2 py-1 rounded text-xs ${activeTab === 'tasks' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800'}`}
              >
                Tasks ({taskList.length})
              </button>
              <button
                onClick={() => setActiveTab('agents')}
                className={`px-2 py-1 rounded text-xs ${activeTab === 'agents' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800'}`}
              >
                Agents ({agentList.length})
              </button>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'tasks' && (
            <div className="p-2 space-y-1">
              {/* New Task Button */}
              <button
                onClick={() => setShowNewTask(!showNewTask)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500 hover:border-zinc-600 hover:text-zinc-400"
              >
                <Plus className="w-3.5 h-3.5" />
                New Task
              </button>

              {/* New Task Form */}
              {showNewTask && (
                <div className="p-3 rounded-lg bg-zinc-800/50 space-y-2">
                  <input
                    type="text"
                    value={newTask.subject}
                    onChange={(e) => setNewTask({ ...newTask, subject: e.target.value })}
                    placeholder="Task subject"
                    className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                  />
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Task description"
                    rows={2}
                    className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleCreateTask} className="flex-1 py-1.5 rounded bg-zinc-100 text-zinc-900 text-xs font-medium hover:bg-white">
                      Create
                    </button>
                    <button onClick={() => setShowNewTask(false)} className="flex-1 py-1.5 rounded bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Task List */}
              {taskList.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-xs">No tasks yet</div>
              ) : (
                taskList.map((task) => {
                  const statusCfg = STATUS_CONFIG[task.status]
                  const StatusIcon = statusCfg.icon
                  const isExpanded = expandedTasks.has(task.id)
                  const isActive = task.id === activeTaskId

                  return (
                    <div
                      key={task.id}
                      className={`rounded-lg border transition-colors ${
                        isActive ? 'border-zinc-600 bg-zinc-800/80' : 'border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <button
                        onClick={() => {
                          toggleExpand(task.id)
                          setActiveTask(task.id)
                          setViewingTask(task.id)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left"
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3 text-zinc-500" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />}
                        <StatusIcon className={`w-3.5 h-3.5 ${statusCfg.color} ${task.status === 'running' ? 'animate-spin' : ''}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-zinc-200 truncate">{task.subject}</div>
                          <div className="text-[10px] text-zinc-600">
                            {new Date(task.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusCfg.bg} ${statusCfg.color}`}>
                          {task.status}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-2 border-t border-zinc-800 pt-2">
                          <p className="text-xs text-zinc-400">{task.description}</p>
                          {task.output && (
                            <pre className="text-[10px] text-zinc-500 bg-zinc-900 rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                              {task.output}
                            </pre>
                          )}
                          {task.error && (
                            <div className="text-[10px] text-red-400 bg-red-900/20 rounded p-2">{task.error}</div>
                          )}
                          <div className="flex gap-1">
                            {task.status === 'running' && (
                              <button
                                onClick={() => stopTask(task.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-[10px] hover:bg-zinc-700"
                              >
                                <Square className="w-2.5 h-2.5" />
                                Stop
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const { tasks: allTasks } = useTaskStore.getState()
                                const updated = { ...allTasks }
                                delete updated[task.id]
                                useTaskStore.setState({ tasks: updated })
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-[10px] hover:bg-zinc-700"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="p-2 space-y-1">
              {/* New Agent Button */}
              <button
                onClick={() => setShowNewAgent(!showNewAgent)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500 hover:border-zinc-600 hover:text-zinc-400"
              >
                <Plus className="w-3.5 h-3.5" />
                New Agent
              </button>

              {/* New Agent Form */}
              {showNewAgent && (
                <div className="p-3 rounded-lg bg-zinc-800/50 space-y-2">
                  <input
                    type="text"
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                    placeholder="Agent name"
                    className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                  />
                  <select
                    value={newAgent.type}
                    onChange={(e) => setNewAgent({ ...newAgent, type: e.target.value })}
                    className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-none"
                  >
                    <option value="general">General</option>
                    <option value="research">Research</option>
                    <option value="code">Code</option>
                    <option value="review">Review</option>
                  </select>
                  <textarea
                    value={newAgent.description}
                    onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                    placeholder="Agent description"
                    rows={2}
                    className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleCreateAgent} className="flex-1 py-1.5 rounded bg-zinc-100 text-zinc-900 text-xs font-medium hover:bg-white">
                      Create
                    </button>
                    <button onClick={() => setShowNewAgent(false)} className="flex-1 py-1.5 rounded bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Agent List */}
              {agentList.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-xs">No agents yet</div>
              ) : (
                agentList.map((agent) => {
                  const statusCfg = AGENT_STATUS_CONFIG[agent.status]

                  return (
                    <div
                      key={agent.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700"
                    >
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                        <span className="text-xs font-medium text-zinc-400">{agent.name[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-zinc-200">{agent.name}</div>
                        <div className="text-[10px] text-zinc-600">{agent.type} {agent.model ? `• ${agent.model}` : ''}</div>
                      </div>
                      <span className={`text-[10px] ${statusCfg.color}`}>{statusCfg.label}</span>
                      <button
                        onClick={() => {
                          const { agents: allAgents } = useTaskStore.getState()
                          const updated = { ...allAgents }
                          delete updated[agent.id]
                          useTaskStore.setState({ agents: updated })
                        }}
                        className="p-1 hover:bg-zinc-800 rounded"
                      >
                        <Trash2 className="w-3 h-3 text-zinc-600" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
