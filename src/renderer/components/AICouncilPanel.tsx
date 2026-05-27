import { useState, useEffect } from 'react'
import {
  CouncilSession,
  createAICouncil,
  type CouncilModelCaller,
} from '../services/AICouncil'
import {
  Bot,
  Users,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  Play,
} from 'lucide-react'

interface AICouncilPanelProps {
  council: ReturnType<typeof createAICouncil>
  callModel?: CouncilModelCaller
}

export function AICouncilPanel({ council, callModel }: AICouncilPanelProps) {
  const [sessions, setSessions] = useState<CouncilSession[]>(council.getAllSessions())
  const [activeSession, setActiveSession] = useState<CouncilSession | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [topic, setTopic] = useState('')
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])

  useEffect(() => {
    council.setCallbacks({
      onSessionUpdate: (session) => {
        setSessions(council.getAllSessions())
        if (activeSession?.id === session.id) {
          setActiveSession(session)
        }
      },
    })
  }, [council, activeSession])

  const handleCreateSession = () => {
    if (!topic.trim()) return

    const session = council.createSession(topic, selectedAgents.length > 0 ? selectedAgents : undefined)
    setActiveSession(session)
    setTopic('')
    setSelectedAgents([])
    setShowCreateModal(false)
  }

  const handleStartDiscussion = async (sessionId: string) => {
    if (callModel) {
      await council.startDiscussion(sessionId, callModel)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'initializing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
      case 'discussing':
        return <MessageSquare className="w-4 h-4 text-green-400" />
      case 'voting':
        return <Users className="w-4 h-4 text-yellow-400" />
      case 'concluded':
        return <CheckCircle2 className="w-4 h-4 text-zinc-400" />
      default:
        return null
    }
  }

  const getAgentColor = (agentId: string) => {
    const colors: Record<string, string> = {
      architect: 'text-blue-400',
      engineer: 'text-green-400',
      reviewer: 'text-red-400',
      researcher: 'text-purple-400',
      planner: 'text-yellow-400',
    }
    return colors[agentId] || 'text-zinc-400'
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-400" />
          <span className="font-semibold text-zinc-100">AI Council</span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600/20 text-cyan-400 rounded-md text-sm hover:bg-cyan-600/30"
        >
          <Plus className="w-4 h-4" />
          New Session
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <Users className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No council sessions yet</p>
            <p className="text-xs mt-1">Create a session to start multi-agent collaboration</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  activeSession?.id === session.id
                    ? 'bg-zinc-800 border-cyan-600/50'
                    : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50'
                }`}
                onClick={() => setActiveSession(session)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(session.status)}
                    <span className="font-medium text-zinc-100 text-sm truncate max-w-[200px]">
                      {session.topic}
                    </span>
                  </div>
                  {session.status === 'initializing' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartDiscussion(session.id)
                      }}
                      className="p-1 text-green-400 hover:bg-green-600/20 rounded"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>{session.agents.length} agents</span>
                  <span>•</span>
                  <span>{session.messages.length} messages</span>
                  {session.conclusion && (
                    <>
                      <span>•</span>
                      <span className="text-zinc-400 truncate max-w-[150px]">
                        {session.conclusion}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeSession && (
        <div className="border-t border-zinc-800 p-3 max-h-64 overflow-y-auto">
          <div className="space-y-2">
            {activeSession.messages.map((message) => (
              <div key={message.id} className="p-2 bg-zinc-900/50 rounded-md">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium ${getAgentColor(message.agentId)}`}>
                    {message.agentName}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-zinc-300">{message.content}</p>
                {message.votes && (
                  <div className="flex items-center gap-2 mt-1">
                    {Object.entries(message.votes).map(([agentId, vote]) => (
                      <div key={agentId} className="flex items-center gap-1 text-xs">
                        {vote === 'approve' ? (
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-400" />
                        )}
                        <span className="text-zinc-500">{agentId}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-zinc-100 mb-4">Create Council Session</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 text-sm"
                  placeholder="What should the council discuss?"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Agents (optional)</label>
                <p className="text-xs text-zinc-500 mb-2">Leave empty to use all active agents</p>
                <div className="space-y-1">
                  {council.getAgents().map((agent) => (
                    <label key={agent.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedAgents.includes(agent.id)}
                        onChange={(e) => {
                          setSelectedAgents((prev) =>
                            e.target.checked
                              ? [...prev, agent.id]
                              : prev.filter((id) => id !== agent.id)
                          )
                        }}
                        className="rounded border-zinc-700 bg-zinc-800 text-cyan-600"
                      />
                      <Bot className="w-4 h-4 text-zinc-500" />
                      <span className="text-zinc-300">{agent.name}</span>
                      <span className="text-xs text-zinc-500">({agent.role})</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                disabled={!topic.trim()}
                className="px-4 py-2 bg-cyan-600 text-white rounded-md text-sm hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
