import { useState, useEffect } from 'react'
import { getKeybindingManager } from '../services/Keybindings'
import type { KeyBinding } from '../services/Keybindings'
import { Keyboard, Search, BookOpen } from 'lucide-react'

const CATEGORY_ICONS: Record<string, string> = {
  navigation: '⌘',
  editing: '✎',
  tools: '⚙',
  view: '⊞',
  general: '⚡',
}

export function KeyboardShortcutsPanel() {
  const [bindings, setBindings] = useState<KeyBinding[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    try {
      const km = getKeybindingManager()
      setBindings(km.getAllBindings())
    } catch { /* keybindings not ready */ }
  }, [])

  const grouped = bindings.reduce<Record<string, KeyBinding[]>>((acc, b) => {
    const cat = b.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(b)
    return acc
  }, {})

  const filtered = search
    ? bindings.filter(b =>
        b.keys.toLowerCase().includes(search.toLowerCase()) ||
        b.description.toLowerCase().includes(search.toLowerCase()) ||
        b.category.toLowerCase().includes(search.toLowerCase())
      )
    : null

  const displayBindings = filtered ?? bindings
  const displayGrouped = filtered
    ? { 'search results': filtered }
    : grouped

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
        <Keyboard className="w-4 h-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-100">Keyboard Shortcuts</h2>
        <span className="text-[10px] text-zinc-500 ml-auto">{bindings.length} shortcuts</span>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
        <Search className="w-3.5 h-3.5 text-zinc-500" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shortcuts..."
          className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {displayBindings.length === 0 ? (
          <div className="text-center py-12 text-zinc-600">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No shortcuts found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(displayGrouped).map(([category, items]) => (
              <section key={category}>
                <h3 className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5 px-1">
                  {CATEGORY_ICONS[category] ?? '•'} {category}
                </h3>
                <div className="space-y-0.5">
                  {items.map((binding) => (
                    <div
                      key={binding.id}
                      className={`flex items-center justify-between px-3 py-2 rounded transition-colors ${
                        binding.enabled ? 'hover:bg-zinc-800/50' : 'opacity-40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-200">{binding.description}</span>
                        {binding.when && (
                          <span className="text-[10px] text-zinc-600 italic">when {binding.when}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {binding.keys.split(' ').map((chord, ci) => (
                          <span key={ci} className="flex items-center gap-0.5">
                            {ci > 0 && <span className="text-zinc-600 text-[10px] mx-0.5">then</span>}
                            {chord.split('+').map((part, pi) => (
                              <span
                                key={pi}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                  ['ctrl', 'alt', 'shift', 'meta', 'cmd', 'option'].includes(part)
                                    ? 'bg-zinc-700 text-zinc-300 uppercase'
                                    : 'bg-zinc-800 text-zinc-100'
                                }`}
                              >
                                {part === 'meta' ? '⌘' : part === 'ctrl' ? '^' : part === 'shift' ? '⇧' : part === 'alt' ? '⌥' : part === 'escape' ? 'Esc' : part}
                              </span>
                            ))}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
