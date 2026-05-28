import { useState } from 'react'
import { useChatStore } from './store/chatStore'
import { MessageSquare, Plus, Settings, Zap, Wrench, X, Sun, Moon } from 'lucide-react'
import { SettingsPanel } from './components/SettingsPanel'
import { ProviderConfigPanel } from './components/ProviderConfigPanel'

type Panel = 'none' | 'settings' | 'providers' | 'skills'

export function ViewSwitcher() {
  const [panel, setPanel] = useState<Panel>('none')
  const { conversations, activeConversationId, createConversation, switchConversation, deleteConversation } = useChatStore()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('light', next === 'light')
  }

  return (
    <>
      {/* Sidebar */}
      <div className="flex flex-col w-[260px] h-full border-r border-zinc-800 bg-zinc-950 flex-shrink-0">
        {/* Logo + actions */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-sm font-semibold tracking-tight text-zinc-300">OpenDesktop</span>
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setPanel(panel === 'settings' ? 'none' : 'settings')} className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* New Chat */}
        <div className="px-3 py-2">
          <button
            onClick={() => createConversation()}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-zinc-800 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center mt-8">No conversations yet</p>
          ) : (
            conversations.map((c: any) => (
              <button
                key={c.id}
                onClick={() => switchConversation(c.id)}
                className={`group flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-sm transition-all mb-0.5 ${
                  activeConversationId === c.id
                    ? 'bg-zinc-800 text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate flex-1">{c.title || 'New Chat'}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(c.id) }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </button>
            ))
          )}
        </div>

        {/* Bottom actions */}
        <div className="border-t border-zinc-800 p-3 flex gap-1">
          <button
            onClick={() => setPanel(panel === 'providers' ? 'none' : 'providers')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors ${
              panel === 'providers' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Zap className="w-3 h-3" /> Providers
          </button>
          <button
            onClick={() => setPanel(panel === 'skills' ? 'none' : 'skills')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors ${
              panel === 'skills' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Wrench className="w-3 h-3" /> Skills
          </button>
        </div>
      </div>

      {/* Slide-out panel */}
      {panel !== 'none' && (
        <div className="w-[320px] border-l border-zinc-800 bg-zinc-950 flex-shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 sticky top-0 bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-300">
              {panel === 'settings' ? 'Settings' : panel === 'providers' ? 'Providers' : 'Skills'}
            </h2>
            <button onClick={() => setPanel('none')} className="p-1 rounded hover:bg-zinc-800 text-zinc-500">
              <X className="w-4 h-4" />
            </button>
          </div>
          {panel === 'settings' && <SettingsPanel />}
          {panel === 'providers' && <ProviderConfigPanel />}
          {panel === 'skills' && (
            <div className="p-4 text-sm text-zinc-500">
              Skills loaded from .opendesktop/skills/ and .claude/skills/
            </div>
          )}
        </div>
      )}
    </>
  )
}
