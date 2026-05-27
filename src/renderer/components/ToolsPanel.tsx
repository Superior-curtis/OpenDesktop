import { useState } from 'react'
import { Terminal, Search, Shield, ShieldCheck, ShieldAlert, BookOpen } from 'lucide-react'

interface ToolDef {
  name: string
  description: string
  riskLevel: 'safe' | 'moderate' | 'dangerous'
}

const BUILTIN_TOOLS: ToolDef[] = [
  { name: 'Read', description: 'Read file contents', riskLevel: 'safe' },
  { name: 'Write', description: 'Write content to files', riskLevel: 'moderate' },
  { name: 'Edit', description: 'Edit file contents', riskLevel: 'moderate' },
  { name: 'Glob', description: 'Search for files by pattern', riskLevel: 'safe' },
  { name: 'Grep', description: 'Search file contents', riskLevel: 'safe' },
  { name: 'Bash', description: 'Execute shell commands', riskLevel: 'dangerous' },
  { name: 'WebSearch', description: 'Search the web', riskLevel: 'safe' },
  { name: 'WebFetch', description: 'Fetch URL content', riskLevel: 'safe' },
  { name: 'Skill', description: 'Execute installed skills', riskLevel: 'moderate' },
  { name: 'task', description: 'Delegate complex tasks to sub-agents', riskLevel: 'moderate' },
  { name: 'MCP', description: 'Call MCP server tools', riskLevel: 'moderate' },
]

const RISK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  safe: ShieldCheck,
  moderate: Shield,
  dangerous: ShieldAlert,
}

const RISK_COLORS: Record<string, string> = {
  safe: 'text-emerald-400',
  moderate: 'text-amber-400',
  dangerous: 'text-red-400',
}

export function ToolsPanel() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ToolDef | null>(null)

  const filtered = search
    ? BUILTIN_TOOLS.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()))
    : BUILTIN_TOOLS

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
        <Terminal className="w-4 h-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-100">Tools</h2>
        <span className="text-[10px] text-zinc-500 ml-auto">{BUILTIN_TOOLS.length} built-in</span>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
        <Search className="w-3.5 h-3.5 text-zinc-500" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools..."
          className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-zinc-600">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No tools found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((tool) => {
              const RiskIcon = RISK_ICONS[tool.riskLevel]
              const riskColor = RISK_COLORS[tool.riskLevel]
              return (
                <div
                  key={tool.name}
                  className="px-3 py-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 transition-colors cursor-pointer"
                  onClick={() => setSelected(selected?.name === tool.name ? null : tool)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RiskIcon className={`w-3.5 h-3.5 ${riskColor}`} />
                      <span className="text-sm text-zinc-200">{tool.name}</span>
                    </div>
                    <span className={`text-[10px] font-medium ${riskColor}`}>
                      {tool.riskLevel}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5 ml-5.5">{tool.description}</p>
                  {selected?.name === tool.name && (
                    <div className="mt-2 pt-2 border-t border-zinc-700/50 text-[10px] flex gap-2">
                      <span className="text-zinc-500">Permission: <span className="text-zinc-400">{tool.riskLevel}</span></span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
