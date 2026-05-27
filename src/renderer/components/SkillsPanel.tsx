import { useState, useEffect, useCallback } from 'react'
import { Wrench, Search, CheckCircle, BookOpen, Copy } from 'lucide-react'
import type { Skill } from '../services/Skills'

const STATIC_SKILLS: Skill[] = [
  {
    type: 'prompt',
    name: 'explain-code',
    displayName: 'Explain Code',
    description: 'Explains selected code in detail',
    content: 'Explain the following code in detail, covering what each part does:',
    contentLength: 0,
    progressMessage: 'Analyzing code...',
    source: 'builtin',
    loadedFrom: 'bundled',
  },
  {
    type: 'prompt',
    name: 'review-code',
    displayName: 'Review Code',
    description: 'Reviews code for issues and improvements',
    content: 'Review the following code for bugs, security issues, and potential improvements:',
    contentLength: 0,
    progressMessage: 'Reviewing code...',
    source: 'builtin',
    loadedFrom: 'bundled',
  },
  {
    type: 'prompt',
    name: 'write-tests',
    displayName: 'Write Tests',
    description: 'Generates unit tests for the given code',
    content: 'Write comprehensive unit tests for the following code:',
    contentLength: 0,
    progressMessage: 'Writing tests...',
    source: 'builtin',
    loadedFrom: 'bundled',
  },
  {
    type: 'prompt',
    name: 'refactor',
    displayName: 'Refactor',
    description: 'Suggests refactoring improvements',
    content: 'Suggest refactoring improvements for the following code. Focus on maintainability, performance, and readability:',
    contentLength: 0,
    progressMessage: 'Analyzing for refactoring...',
    source: 'builtin',
    loadedFrom: 'bundled',
  },
]

export function SkillsPanel() {
  const [dynamicSkills, setDynamicSkills] = useState<Skill[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    try {
      import('../services/Skills').then(mod => {
        setDynamicSkills(mod.getDynamicSkills() || [])
      })
    } catch { /* not ready */ }
  }, [])

  const allSkills = [...STATIC_SKILLS, ...dynamicSkills.filter(ds => !STATIC_SKILLS.find(s => s.name === ds.name))]

  const filtered = search
    ? allSkills.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.displayName ?? s.name).toLowerCase().includes(search.toLowerCase()) || s.description?.toLowerCase().includes(search.toLowerCase()))
    : allSkills

  const handleCopy = useCallback((name: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopied(name)
    setTimeout(() => setCopied(null), 2000)
  }, [])

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
        <Wrench className="w-4 h-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-100">Skills</h2>
        <span className="text-[10px] text-zinc-500 ml-auto">{allSkills.length} available</span>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
        <Search className="w-3.5 h-3.5 text-zinc-500" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills..."
          className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-zinc-600">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No skills found</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((skill) => (
              <div
                key={skill.name}
                className="px-3 py-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 transition-colors cursor-pointer"
                onClick={() => setSelected(selected === skill.name ? null : skill.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-sm text-zinc-200">{skill.displayName ?? skill.name}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopy(skill.name, skill.content) }}
                    className="p-1 hover:bg-zinc-700 rounded"
                    title="Copy prompt"
                  >
                    {copied === skill.name
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      : <Copy className="w-3.5 h-3.5 text-zinc-500" />
                    }
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5 ml-5.5">{skill.description}</p>
                {selected === skill.name && (
                  <div className="mt-2 pt-2 border-t border-zinc-700/50 text-[10px] text-zinc-500 space-y-1">
                    <div>Type: <span className="text-zinc-400">{skill.type}</span></div>
                    <div>Source: <span className="text-zinc-400">{skill.source}</span></div>
                    {skill.allowedTools && <div>Tools: <span className="text-zinc-400">{skill.allowedTools.join(', ')}</span></div>}
                    {skill.model && <div>Model: <span className="text-zinc-400">{skill.model}</span></div>}
                    <div className="mt-2 px-2 py-1.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[10px]">
                      {skill.content.slice(0, 300)}{skill.content.length > 300 ? '...' : ''}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
