import { useState } from 'react'
import { useChatStore } from './store/chatStore'
import { ApiClient } from './services/ApiClient'
import { X, Play, Loader2, CheckCircle, AlertCircle, Zap } from 'lucide-react'

interface AgentTask {
  id: string
  name: string
  prompt: string
  status: 'idle' | 'running' | 'done' | 'error'
  result: string
}

export function AgentSwarm({ onClose }: { onClose: () => void }) {
  const { providers, activeProviderId } = useChatStore()
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [topic, setTopic] = useState('')
  const [running, setRunning] = useState(false)

  const runSwarm = async () => {
    if (!topic.trim() || running) return
    const provider = providers.find((p: any) => p.id === activeProviderId)
    if (!provider) return

    // Create parallel agents
    const agents: AgentTask[] = [
      { id: '1', name: '🔍 Researcher', prompt: `Research this topic thoroughly: "${topic}". Find key facts, data, and insights. Be concise.`, status: 'idle', result: '' },
      { id: '2', name: '⚖️ Critic', prompt: `Critically analyze this topic: "${topic}". Find flaws, counterarguments, and limitations.`, status: 'idle', result: '' },
      { id: '3', name: '💡 Innovator', prompt: `Generate creative and innovative ideas about: "${topic}". Think outside the box.`, status: 'idle', result: '' },
      { id: '4', name: '📝 Synthesizer', prompt: `After reviewing all perspectives on "${topic}", create a comprehensive summary with actionable insights.`, status: 'idle', result: '' },
    ]

    setTasks(agents.map(a => ({ ...a, status: 'running' as const })))
    setRunning(true)

    // Run all 4 agents in parallel
    await Promise.all(agents.map(async (agent) => {
      try {
        const client = new ApiClient(provider)
        const msgs = [{ id: '1', role: 'user' as const, content: agent.prompt, timestamp: Date.now() }]
        const stream = await client.chat(msgs, true)

        let content = ''
        for await (const chunk of stream) {
          if (typeof chunk === 'string') {
            content += chunk
            setTasks(prev => prev.map(t =>
              t.id === agent.id ? { ...t, result: content } : t
            ))
          }
        }
        setTasks(prev => prev.map(t =>
          t.id === agent.id ? { ...t, status: 'done' as const, result: content } : t
        ))
        return content
      } catch (err: any) {
        setTasks(prev => prev.map(t =>
          t.id === agent.id ? { ...t, status: 'error' as const, result: err.message } : t
        ))
        return ''
      }
    }))

    setRunning(false)
  }

  const doneCount = tasks.filter(t => t.status === 'done').length
  const runningCount = tasks.filter(t => t.status === 'running').length

  return (
    <div className="fixed inset-0 z-50 bg-[#111] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <Zap className="w-5 h-5 text-amber-400" />
        <span className="text-base font-semibold text-zinc-200">Agent Swarm</span>
        <span className="text-xs text-zinc-600">— 4 AI agents work in parallel</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 mr-4">
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runSwarm()}
            placeholder="What should the swarm research?"
            className="w-72 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
          />
          <button
            onClick={runSwarm}
            disabled={!topic.trim() || running}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-30"
          >
            <Play className="w-3.5 h-3.5" /> Run Swarm
          </button>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500"><X className="w-4 h-4" /></button>
      </div>

      {/* Progress */}
      {runningCount > 0 && (
        <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
          <span className="text-sm text-zinc-400">
            {doneCount}/4 agents completed • Running in parallel
          </span>
          <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
            <div className="bg-amber-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${(doneCount / 4) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Agent Grid */}
      <div className="flex-1 grid grid-cols-2 gap-3 p-4 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center justify-center text-center">
            <div className="text-5xl mb-4">🐝</div>
            <h2 className="text-xl font-semibold text-zinc-300 mb-2">Agent Swarm</h2>
            <p className="text-sm text-zinc-500 max-w-md leading-relaxed">
              Type a topic above and watch 4 AI agents research, critique, innovate, and synthesize — all in parallel.
              Each agent has a different perspective.
            </p>
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className={`rounded-xl border p-4 flex flex-col ${
              task.status === 'running' ? 'border-amber-500/30 bg-zinc-900' :
              task.status === 'done' ? 'border-emerald-500/20 bg-zinc-900' :
              task.status === 'error' ? 'border-red-500/20 bg-zinc-900' :
              'border-zinc-800 bg-zinc-900/50'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{task.name.slice(0, 2)}</span>
                <span className="text-sm font-medium text-zinc-300">{task.name.slice(2)}</span>
                <div className="flex-1" />
                {task.status === 'running' && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                {task.status === 'done' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                {task.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
              </div>
              <div className="flex-1 overflow-y-auto">
                {task.result ? (
                  <div className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">{task.result}</div>
                ) : task.status === 'running' ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-600">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Thinking...
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
