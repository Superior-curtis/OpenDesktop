import { useState } from 'react'
import { Plus, Trash2, Play, Pause, Bot, Code, FileText, Search, Wrench, Settings2 } from 'lucide-react'

interface SubAgent {
  id: string
  name: string
  description: string
  icon: string
  systemPrompt: string
  isActive: boolean
  taskCount: number
}

interface SubAgentsPanelProps {
  onClose: () => void
}

const AGENT_TEMPLATES = [
  { name: 'Code Reviewer', description: 'Reviews code for bugs and best practices', icon: 'code', prompt: 'You are an expert code reviewer. Review the provided code for bugs, security issues, and best practices.' },
  { name: 'Document Writer', description: 'Writes and formats documentation', icon: 'file', prompt: 'You are a technical writer. Create clear, concise documentation for the provided topic.' },
  { name: 'Research Agent', description: 'Researches topics and summarizes findings', icon: 'search', prompt: 'You are a research assistant. Research the given topic and provide a comprehensive summary.' },
  { name: 'Debug Helper', description: 'Helps debug and fix code issues', icon: 'wrench', prompt: 'You are a debugging expert. Analyze the error and suggest fixes.' },
]

export function SubAgentsPanel({ onClose }: SubAgentsPanelProps) {
  const [agents, setAgents] = useState<SubAgent[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [newAgent, setNewAgent] = useState({ name: '', description: '', prompt: '' })

  const iconMap: Record<string, any> = {
    code: Code,
    file: FileText,
    search: Search,
    wrench: Wrench,
    default: Bot,
  }

  const handleAddAgent = (template?: typeof AGENT_TEMPLATES[0]) => {
    const name = template ? template.name : newAgent.name
    const description = template ? template.description : newAgent.description
    const prompt = template ? template.prompt : newAgent.prompt
    const icon = template?.icon || 'default'

    if (!name.trim()) return

    setAgents([...agents, {
      id: crypto.randomUUID(),
      name,
      description,
      icon,
      systemPrompt: prompt,
      isActive: false,
      taskCount: 0,
    }])

    setNewAgent({ name: '', description: '', prompt: '' })
    setShowTemplates(false)
  }

  const toggleAgent = (id: string) => {
    setAgents(agents.map((a) =>
      a.id === id ? { ...a, isActive: !a.isActive } : a
    ))
  }

  const removeAgent = (id: string) => {
    setAgents(agents.filter((a) => a.id !== id))
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl overflow-hidden border border-zinc-800" style={{ background: '#18181b' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Sub-Agents</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg">
              <Settings2 className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Templates Dropdown */}
        {showTemplates && (
          <div className="p-3 border-b border-zinc-800 bg-zinc-900/50">
            <h3 className="text-xs text-zinc-500 mb-2">Choose a template or create custom:</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {AGENT_TEMPLATES.map((t) => {
                const Icon = iconMap[t.icon] || iconMap.default
                return (
                  <button
                    key={t.name}
                    onClick={() => handleAddAgent(t)}
                    className="flex items-start gap-2 p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-left"
                  >
                    <Icon className="w-4 h-4 text-zinc-400 mt-0.5" />
                    <div>
                      <div className="text-xs font-medium text-zinc-200">{t.name}</div>
                      <div className="text-[10px] text-zinc-500">{t.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="space-y-2">
              <input
                type="text" value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                placeholder="Custom agent name"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
              <input
                type="text" value={newAgent.description} onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                placeholder="Description"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
              <textarea
                value={newAgent.prompt} onChange={(e) => setNewAgent({ ...newAgent, prompt: e.target.value })}
                placeholder="System prompt..."
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 resize-none h-16"
              />
              <button
                onClick={() => handleAddAgent()}
                className="w-full py-2 rounded-lg bg-zinc-100 text-zinc-900 text-xs hover:bg-white"
              >
                Create Custom Agent
              </button>
            </div>
          </div>
        )}

        {/* Agent List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {agents.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">
              No sub-agents yet. Add one to get started.
            </div>
          ) : (
            agents.map((agent) => {
              const Icon = iconMap[agent.icon] || iconMap.default
              return (
                <div key={agent.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
                  <div className={`p-2 rounded-lg ${agent.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-700 text-zinc-500'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200">{agent.name}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${agent.isActive ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{agent.description}</p>
                  </div>
                  <span className="text-[10px] text-zinc-600">{agent.isActive ? 'Running' : 'Idle'}</span>
                  <button onClick={() => toggleAgent(agent.id)} className="p-1.5 hover:bg-zinc-700 rounded">
                    {agent.isActive ? <Pause className="w-3.5 h-3.5 text-emerald-400" /> : <Play className="w-3.5 h-3.5 text-zinc-500" />}
                  </button>
                  <button onClick={() => removeAgent(agent.id)} className="p-1.5 hover:bg-zinc-700 rounded">
                    <Trash2 className="w-3.5 h-3.5 text-zinc-500" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
