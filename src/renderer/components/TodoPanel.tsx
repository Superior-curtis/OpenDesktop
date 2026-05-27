import { useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import { X, Plus, Trash2, GripVertical, Circle, CheckCircle2 } from 'lucide-react'

interface TodoPanelProps {
  onClose: () => void
}

export function TodoPanel({ onClose }: TodoPanelProps) {
  const { tasks, createTask, updateTask } = useTaskStore()
  const [newTodo, setNewTodo] = useState('')

  const todoList = Object.values(tasks)
    .filter((t) => !t.output && !t.error)
    .sort((a, b) => {
      const statusOrder = { pending: 0, running: 1, completed: 2, stopped: 3, failed: 4, blocked: 5 }
      return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0)
    })

  const handleAdd = () => {
    if (!newTodo.trim()) return
    createTask(newTodo.trim(), '')
    setNewTodo('')
  }

  const handleToggle = (id: string, currentStatus: string) => {
    updateTask(id, {
      status: currentStatus === 'completed' ? 'pending' : 'completed',
    })
  }

  const handleDelete = (id: string) => {
    const { tasks: allTasks } = useTaskStore.getState()
    const updated = { ...allTasks }
    delete updated[id]
    useTaskStore.setState({ tasks: updated })
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-xl overflow-hidden border border-zinc-800" style={{ background: '#18181b' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Todos</h2>
            <span className="text-xs text-zinc-500">({todoList.length})</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Add Todo */}
        <div className="p-3 border-b border-zinc-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Add a task..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={handleAdd}
              disabled={!newTodo.trim()}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 text-xs hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Todo List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
          {todoList.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-xs">No tasks yet</div>
          ) : (
            todoList.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded group hover:bg-zinc-800/50 ${
                  task.status === 'completed' ? 'opacity-50' : ''
                }`}
              >
                <GripVertical className="w-3 h-3 text-zinc-700 cursor-grab opacity-0 group-hover:opacity-100" />
                <button
                  onClick={() => handleToggle(task.id, task.status)}
                  className="flex-shrink-0"
                >
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-600" />
                  )}
                </button>
                <span className={`flex-1 text-xs truncate ${
                  task.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-300'
                }`}>
                  {task.subject}
                </span>
                <span className={`text-[10px] px-1 py-0.5 rounded ${
                  task.status === 'pending' ? 'bg-zinc-800 text-zinc-500' :
                  task.status === 'running' ? 'bg-blue-900/30 text-blue-400' :
                  task.status === 'completed' ? 'bg-emerald-900/30 text-emerald-400' :
                  'bg-red-900/30 text-red-400'
                }`}>
                  {task.status}
                </span>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-700 rounded"
                >
                  <Trash2 className="w-3 h-3 text-zinc-500" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
