import React from 'react'
import { useChatStore } from '../store/chatStore'
import { Plus, Trash2 } from 'lucide-react'

export function Sidebar() {
  const {
    conversations,
    activeConversationId,
    switchConversation,
    createConversation,
    deleteConversation,
    isSidebarOpen,
    toggleSidebar,
  } = useChatStore()

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (conversations.length <= 1) return
    deleteConversation(id)
  }

  const formatDate = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    if (diff < 86400000) return 'Today'
    if (diff < 172800000) return 'Yesterday'
    return new Date(timestamp).toLocaleDateString()
  }

  // Collapsed state: just a thin strip with icon
  if (!isSidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="flex flex-col items-center pt-3 w-12 flex-shrink-0 border-r border-zinc-800 hover:bg-zinc-800/30 transition-colors"
        title="Open chats"
      >
        <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center">
          <Plus className="w-3.5 h-3.5 text-zinc-500" />
        </div>
      </button>
    )
  }

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-[#1e1e1e] border-r border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Chats</span>
        <button
          onClick={createConversation}
          className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="New chat"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => switchConversation(conv.id)}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-sm transition-colors group ${
              activeConversationId === conv.id
                ? 'bg-zinc-800 text-zinc-200'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="truncate">{conv.title || 'New Chat'}</div>
              <div className="text-[10px] text-zinc-600">{formatDate(conv.updatedAt)}</div>
            </div>
            {conversations.length > 1 && (
              <button
                onClick={(e) => handleDelete(e, conv.id)}
                className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-red-400 rounded transition-all"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 border-t border-zinc-800">
        <button
          onClick={createConversation}
          className="w-full py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
        >
          New Chat
        </button>
      </div>
    </aside>
  )
}
