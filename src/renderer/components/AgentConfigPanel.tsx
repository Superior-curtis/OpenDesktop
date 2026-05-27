import { useAppStateStore } from '../store/appStateStore'
import { Bot, Users, Cpu, Clock } from 'lucide-react'

const AGENT_MODELS = [
  { value: 'sonnet', label: 'Sonnet', desc: 'Balanced speed/quality' },
  { value: 'opus', label: 'Opus', desc: 'Maximum quality' },
  { value: 'haiku', label: 'Haiku', desc: 'Fast and cheap' },
]

export function AgentConfigPanel() {
  const appState = useAppStateStore()

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
        <Bot className="w-4 h-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-100">Agent Configuration</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Default Agent Model</h3>
          <p className="text-xs text-zinc-500 mb-3">Model used for sub-agent tasks.</p>
          <div className="space-y-1.5">
            {AGENT_MODELS.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => appState.setDefaultAgentModel(value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                  appState.defaultAgentModel === value
                    ? 'border-zinc-600 bg-zinc-800'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <Cpu className={`w-4 h-4 ${appState.defaultAgentModel === value ? 'text-purple-400' : 'text-zinc-600'}`} />
                <div>
                  <div className="text-xs text-zinc-200">{label}</div>
                  <div className="text-[10px] text-zinc-500">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Concurrency</h3>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs text-zinc-300">Max concurrent agents</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1} max={10} step={1}
              value={appState.maxConcurrentAgents}
              onChange={(e) => appState.setMaxConcurrentAgents(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-zinc-300 w-8 text-right font-mono">{appState.maxConcurrentAgents}</span>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Timeout</h3>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs text-zinc-300">Agent timeout (seconds)</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={60} max={600} step={30}
              value={appState.agentTimeout}
              onChange={(e) => appState.setAgentTimeout(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-zinc-300 w-12 text-right font-mono">{appState.agentTimeout}s</span>
          </div>
        </section>
      </div>
    </div>
  )
}
