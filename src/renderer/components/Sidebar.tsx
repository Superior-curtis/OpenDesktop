import React from 'react'
import { useChatStore } from '../store/chatStore'
import { Plus, MessageSquare, Trash2, PanelLeftClose } from 'lucide-react'

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

  const handleNewChat = () => {
    createConversation()
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (conversations.length <= 1) return
    deleteConversation(id)
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      <aside
        className={`flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
        }`}
      >
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Chats
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewChat}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
              title="New chat"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={toggleSidebar}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => switchConversation(conv.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors group ${
                activeConversationId === conv.id
                  ? 'bg-secondary'
                  : 'hover:bg-secondary/50'
              }`}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {conv.title || 'New Chat'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(conv.updatedAt)}
                </div>
              </div>
              {conversations.length > 1 && (
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                  title="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-border">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>
      </aside>

      {!isSidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed left-2 top-3 z-50 p-2 hover:bg-secondary rounded-lg transition-colors bg-background border border-border"
          title="Expand sidebar"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      )}
    </>
  )
}
