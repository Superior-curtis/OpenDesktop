import { useState, useEffect } from 'react'
import { liveStatusService, LiveStatus } from '../services/LiveStatusService'
import {
  Cpu,
  MessageSquare,
  Zap,
  Wrench,
  Bot,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react'

export function LiveStatusBar() {
  const [status, setStatus] = useState<LiveStatus>(liveStatusService.getStatus())

  useEffect(() => {
    const unsubscribe = liveStatusService.subscribe(setStatus)
    return unsubscribe
  }, [])

  if (!status.isRunning && !status.isThinking && !status.isWaitingForUser) {
    return null
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/50 border-t border-zinc-800 text-xs text-zinc-400">
      {status.isRunning && (
        <div className="flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
          <span>Running</span>
        </div>
      )}

      {status.isThinking && (
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-purple-400" />
          <span>Thinking...</span>
        </div>
      )}

      {status.isWaitingForUser && (
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-3 h-3 text-yellow-400" />
          <span>Waiting for your response</span>
        </div>
      )}

      {status.lastToolCall && (
        <div className="flex items-center gap-1.5">
          <Wrench className="w-3 h-3 text-green-400" />
          <span>{status.lastToolCall.name}: {status.lastToolCall.status}</span>
        </div>
      )}

      {status.activeAgents.length > 0 && (
        <div className="flex items-center gap-1.5">
          <Bot className="w-3 h-3 text-cyan-400" />
          <span>{status.activeAgents.join(', ')}</span>
        </div>
      )}

      <div className="flex items-center gap-3 ml-auto">
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          <span>{(status.tokenUsage.current / 1000).toFixed(1)}k tokens</span>
        </div>

        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Turn {status.turnCount.current}/{status.turnCount.limit}</span>
        </div>

        {status.compactStatus.failures > 0 && (
          <div className="flex items-center gap-1 text-red-400">
            <AlertCircle className="w-3 h-3" />
            <span>{status.compactStatus.failures} compact failures</span>
          </div>
        )}

        {status.error && (
          <div className="flex items-center gap-1 text-red-400">
            <AlertCircle className="w-3 h-3" />
            <span>{status.error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function TokenProgressBar() {
  const [status, setStatus] = useState<LiveStatus>(liveStatusService.getStatus())

  useEffect(() => {
    const unsubscribe = liveStatusService.subscribe(setStatus)
    return unsubscribe
  }, [])

  const percentage = status.tokenUsage.percentage
  const color =
    percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-yellow-500' : 'bg-green-500'

  return (
    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-300`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export function ContextWindowIndicator() {
  const [status, setStatus] = useState<LiveStatus>(liveStatusService.getStatus())

  useEffect(() => {
    const unsubscribe = liveStatusService.subscribe(setStatus)
    return unsubscribe
  }, [])

  const percentage = status.contextWindow.percentage
  const color =
    percentage > 90 ? 'text-red-400' : percentage > 70 ? 'text-yellow-400' : 'text-green-400'

  return (
    <div className={`text-xs ${color}`}>
      Context: {(status.contextWindow.used / 1000).toFixed(1)}k / {(status.contextWindow.total / 1000).toFixed(0)}k ({percentage.toFixed(0)}%)
    </div>
  )
}
