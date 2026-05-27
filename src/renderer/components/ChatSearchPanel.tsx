import { useState, useMemo } from 'react'
import { useChatStore } from '../store/chatStore'
import { Search, MessageSquare, User, Bot, X, Calendar } from 'lucide-react'
import type { Message } from '../types'

export function ChatSearchPanel() {
  const { messages, conversations, switchConversation } = useChatStore()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'all' | 'conversations' | 'messages'>('messages')

  const results = useMemo(() => {
    if (!query.trim()) return { messages: [] as Message[], conversations: [] as typeof conversations }

    const q = query.toLowerCase()

    const matchedMessages = messages.filter(
      (m) => m.content.toLowerCase().includes(q) || m.role.toLowerCase().includes(q) || m.provider?.toLowerCase().includes(q)
    )

    const matchedConversations = conversations.filter(
      (c) => c.title.toLowerCase().includes(q)
    )

    return { messages: matchedMessages, conversations: matchedConversations }
  }, [query, messages, conversations])

  // Add keyboard shortcut
  const handleClear = () => {
    setQuery('')
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
        <Search className="w-4 h-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-100">Search Chats</h2>
      </div>

      <div className="px-4 py-2 border-b border-zinc-800 space-y-2">
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages and conversations..."
            className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
            autoFocus
          />
          {query && (
            <button onClick={handleClear} className="p-0.5 hover:bg-zinc-700 rounded">
              <X className="w-3 h-3 text-zinc-500" />
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {(['messages', 'conversations', 'all'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                mode === m ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!query.trim() ? (
          <div className="text-center py-12 text-zinc-600">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Type to search across {messages.length} messages and {conversations.length} conversations</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(mode === 'conversations' || mode === 'all') && results.conversations.length > 0 && (
              <section>
                <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 px-1">
                  Conversations ({results.conversations.length})
                </h3>
                <div className="space-y-0.5">
                  {results.conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => switchConversation(c.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded hover:bg-zinc-800/50 text-left transition-colors"
                    >
                      <MessageSquare className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-zinc-200 truncate">{c.title}</div>
                        <div className="text-[10px] text-zinc-600">{c.messages.length} messages</div>
                      </div>
                      <Calendar className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {(mode === 'messages' || mode === 'all') && (
              <section>
                <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 px-1">
                  Messages{results.messages.length > 0 ? ` (${results.messages.length})` : ''}
                </h3>
                {results.messages.length === 0 ? (
                  <div className="text-center py-8 text-zinc-600 text-xs">No messages match your search</div>
                ) : (
                  <div className="space-y-0.5">
                    {results.messages.map((m) => (
                      <div key={m.id} className="px-2.5 py-2 rounded bg-zinc-800/30">
                        <div className="flex items-center gap-1.5 mb-1">
                          {m.role === 'user' ? (
                            <User className="w-3 h-3 text-zinc-500" />
                          ) : (
                            <Bot className="w-3 h-3 text-zinc-500" />
                          )}
                          <span className="text-[10px] text-zinc-500 uppercase">{m.role}</span>
                          <span className="text-[10px] text-zinc-700">{new Date(m.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs text-zinc-300 line-clamp-2">
                          {highlightMatch(m.content, query)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function highlightMatch(text: string, query: string): React.ReactNode {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, Math.max(0, idx - 50))}
      {idx > 50 && <span className="text-zinc-600">...</span>}
      {text.slice(Math.max(0, idx - 50), idx)}
      <mark className="bg-amber-600/30 text-amber-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length, idx + query.length + 100)}
      {idx + query.length + 100 < text.length && <span className="text-zinc-600">...</span>}
    </>
  )
}
