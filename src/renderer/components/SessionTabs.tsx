import { useState } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import { Plus, X, Pin, Rows, Grid, GripVertical, LayoutDashboard, Columns2 } from 'lucide-react'

export function SessionTabs() {
  const {
    sessions,
    activeSessionId,
    switchSession,
    addSession,
    removeSession,
    renameSession,
    layout,
    setLayout,
    pinnedSessions,
    togglePinSession,
    reorderSessions,
  } = useWorkspaceStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sessionId: string } | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const handleStartEdit = (session: { id: string; name: string }) => {
    setEditingId(session.id)
    setEditName(session.name)
    setContextMenu(null)
  }

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      renameSession(editingId, editName.trim())
    }
    setEditingId(null)
  }

  const handleLayoutChange = (newLayout: typeof layout) => {
    setLayout(newLayout)
  }

  const handleDragStart = (sessionId: string) => {
    setDraggedId(sessionId)
  }

  const handleDragOver = (e: React.DragEvent, sessionId: string) => {
    e.preventDefault()
    if (sessionId !== draggedId) {
      setDragOverId(sessionId)
    }
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) return

    const fromIndex = sessions.findIndex((s) => s.id === draggedId)
    const toIndex = sessions.findIndex((s) => s.id === targetId)
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderSessions(fromIndex, toIndex)
    }
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-zinc-800 bg-zinc-900/50">
      {/* Session Tabs */}
      <div className="flex items-center gap-0.5 flex-1 overflow-x-auto">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId
          const isPinned = pinnedSessions.includes(session.id)
          const isDragged = draggedId === session.id
          const isDragOver = dragOverId === session.id

          return (
            <div
              key={session.id}
              draggable
              onDragStart={() => handleDragStart(session.id)}
              onDragOver={(e) => handleDragOver(e, session.id)}
              onDrop={(e) => handleDrop(e, session.id)}
              onDragEnd={handleDragEnd}
              className={`group flex items-center gap-0.5 px-1 py-1.5 rounded-md text-xs cursor-pointer transition-all min-w-0 ${
                isDragged ? 'opacity-50' : ''
              } ${
                isDragOver ? 'ring-1 ring-zinc-500' : ''
              } ${
                isActive
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
              }`}
              onClick={() => switchSession(session.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ x: e.clientX, y: e.clientY, sessionId: session.id })
              }}
            >
              <GripVertical className="w-3 h-3 text-zinc-600 cursor-grab active:cursor-grabbing flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              {isPinned && <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" />}

              {editingId === session.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="w-20 bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-xs text-zinc-100 focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate max-w-[120px]" title={session.name}>{session.name}</span>
              )}

              {sessions.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeSession(session.id)
                  }}
                  className="p-0.5 rounded hover:bg-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )
        })}

        <button
          onClick={addSession}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="New Session"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Layout Controls */}
      <div className="flex items-center gap-0.5 ml-2">
        <button
          onClick={() => handleLayoutChange('single')}
          className={`p-1 rounded ${layout === 'single' ? 'bg-zinc-700 text-zinc-300' : 'text-zinc-600 hover:text-zinc-400'}`}
          title="Single"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleLayoutChange('split-h')}
          className={`p-1 rounded ${layout === 'split-h' ? 'bg-zinc-700 text-zinc-300' : 'text-zinc-600 hover:text-zinc-400'}`}
          title="Split Horizontal"
        >
          <Columns2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleLayoutChange('split-v')}
          className={`p-1 rounded ${layout === 'split-v' ? 'bg-zinc-700 text-zinc-300' : 'text-zinc-600 hover:text-zinc-400'}`}
          title="Split Vertical"
        >
          <Rows className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleLayoutChange('grid')}
          className={`p-1 rounded ${layout === 'grid' ? 'bg-zinc-700 text-zinc-300' : 'text-zinc-600 hover:text-zinc-400'}`}
          title="Grid"
        >
          <Grid className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 w-40 rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => handleStartEdit(sessions.find((s) => s.id === contextMenu.sessionId)!)}
              className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700"
            >
              Rename
            </button>
            <button
              onClick={() => {
                togglePinSession(contextMenu.sessionId)
                setContextMenu(null)
              }}
              className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700"
            >
              {pinnedSessions.includes(contextMenu.sessionId) ? 'Unpin' : 'Pin'}
            </button>
            {sessions.length > 1 && (
              <button
                onClick={() => {
                  removeSession(contextMenu.sessionId)
                  setContextMenu(null)
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-zinc-700"
              >
                Close
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
