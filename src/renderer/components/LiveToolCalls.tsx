import { useState, useEffect } from 'react'
import { liveStatusService, type ActiveToolCall } from '../services/LiveStatusService'
import { Loader2, Check, AlertCircle, Wrench, Terminal, FileText, Search, Globe } from 'lucide-react'

const toolIcons: Record<string, typeof Wrench> = {
  Bash: Terminal,
  Write: FileText,
  Read: FileText,
  Edit: FileText,
  Glob: Search,
  Grep: Search,
  WebFetch: Globe,
  WebSearch: Globe,
}

function getToolIcon(name: string) {
  for (const [key, Icon] of Object.entries(toolIcons)) {
    if (name.includes(key)) return Icon
  }
  return Wrench
}

export function LiveToolCalls() {
  const [calls, setCalls] = useState<ActiveToolCall[]>([])

  useEffect(() => {
    const unsub = liveStatusService.subscribe((s) => {
      setCalls([...s.activeToolCalls])
    })
    return unsub
  }, [])

  if (calls.length === 0) return null

  return (
    <div className="space-y-1.5 mb-3">
      {calls.map((call) => {
        const Icon = getToolIcon(call.name)
        return (
          <div
            key={call.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
              call.status === 'executing'
                ? 'bg-blue-500/5 border-blue-500/20 text-blue-300'
                : call.status === 'completed'
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                  : 'bg-red-500/5 border-red-500/20 text-red-300'
            }`}
          >
            {call.status === 'executing' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : call.status === 'completed' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            <Icon className="w-3.5 h-3.5 opacity-70" />
            <span className="font-medium">{call.name}</span>
            {call.progress.length > 0 && (
              <span className="text-muted-foreground truncate max-w-[200px]">
                {call.progress[call.progress.length - 1]}
              </span>
            )}
            {call.status === 'executing' && (
              <span className="ml-auto text-muted-foreground">
                {((Date.now() - call.startedAt) / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
