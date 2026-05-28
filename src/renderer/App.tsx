import { useState, useEffect } from 'react'
import { SettingsModal } from './components/SettingsModal'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './ChatArea'
import { CodeSandbox } from './CodeSandbox'
import { AgentSwarm } from './AgentSwarm'
import { Settings, Code, Zap } from 'lucide-react'
import { useChatStore } from './store/chatStore'

export default function App() {
  const [ready, setReady] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSandbox, setShowSandbox] = useState(false)
  const [showSwarm, setShowSwarm] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 200)
    return () => clearTimeout(t)
  }, [])

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#1a1a1a]">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-zinc-500 to-zinc-700 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1a1a1a] text-zinc-100">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <Header
          onSettings={() => setShowSettings(true)}
          onSandbox={() => setShowSandbox(true)}
          onSwarm={() => setShowSwarm(true)}
        />
        <ChatArea />
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showSandbox && <CodeSandbox onClose={() => setShowSandbox(false)} />}
      {showSwarm && <AgentSwarm onClose={() => setShowSwarm(false)} />}
    </div>
  )
}

function Header({ onSettings, onSandbox, onSwarm }: {
  onSettings: () => void; onSandbox: () => void; onSwarm: () => void
}) {
  const { providers, activeProviderId } = useChatStore()
  const provider = providers.find((p: any) => p.id === activeProviderId)

  return (
    <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
      <div />
      <div className="flex items-center gap-1.5">
        {provider && (
          <span className="text-[11px] text-zinc-600 font-mono mr-2">{provider.model}</span>
        )}
        <button onClick={onSwarm} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition-colors text-xs" title="Agent Swarm — 4 AIs in parallel">
          <Zap className="w-3.5 h-3.5" /> Swarm
        </button>
        <button onClick={onSandbox} className="p-1.5 rounded-md text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition-colors" title="Code Sandbox">
          <Code className="w-4 h-4" />
        </button>
        <button onClick={onSettings} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors" title="Settings">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
