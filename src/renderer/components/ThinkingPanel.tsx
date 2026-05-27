import { useState, useEffect } from 'react'
import { Brain, Sparkles, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useChatStore } from '../store/chatStore'
import { liveStatusService } from '../services/LiveStatusService'

export function ThinkingPanel() {
  const { settings, updateSettings, isThinkingPanelOpen, setIsThinkingPanelOpen } = useChatStore()
  const [expanded, setExpanded] = useState(true)
  const [thinkingContent, setThinkingContent] = useState('')
  const [isThinking, setIsThinking] = useState(false)

  useEffect(() => {
    const unsub = liveStatusService.subscribe((s) => {
      setThinkingContent(s.thinkingContent)
      setIsThinking(s.isThinking)
    })
    return unsub
  }, [])

  if (!isThinkingPanelOpen) return null

  const thinking = settings.thinking

  return (
    <div className="fixed right-4 top-16 w-80 bg-card border border-border rounded-xl shadow-2xl z-40 overflow-hidden flex flex-col max-h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between p-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Brain className={`w-5 h-5 ${isThinking ? 'text-purple-400 animate-pulse' : 'text-purple-500'}`} />
          <h3 className="text-sm font-semibold">Thinking</h3>
        </div>
        <button
          onClick={() => setIsThinkingPanelOpen(false)}
          className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Thinking Content */}
        {isThinking && thinkingContent && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
              <span className="text-xs font-medium text-purple-400">Thinking...</span>
            </div>
            <pre className="text-xs text-purple-300/70 bg-purple-500/5 rounded-lg p-3 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
              {thinkingContent}
            </pre>
          </div>
        )}

        {isThinking && !thinkingContent && (
          <div className="flex items-center gap-2 p-3 bg-purple-500/10 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
            <span className="text-sm text-purple-500">Thinking...</span>
          </div>
        )}

        {!isThinking && thinkingContent && (
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Last thinking output</span>
            <pre className="text-xs text-muted-foreground bg-secondary rounded-lg p-3 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
              {thinkingContent}
            </pre>
          </div>
        )}

        {/* Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Enable Thinking</span>
          <button
            onClick={() => updateSettings({ thinking: { ...thinking, enabled: !thinking.enabled } })}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              thinking.enabled ? 'bg-purple-500' : 'bg-muted'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transition-transform absolute top-0.5 ${
                thinking.enabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Mode Selection */}
        <div>
          <span className="text-sm font-medium mb-2 block">Thinking Mode</span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { value: 'adaptive' as const, label: 'Adaptive', icon: Sparkles },
              { value: 'ultrathink' as const, label: 'Deep', icon: Brain },
              { value: 'disabled' as const, label: 'Off', icon: X },
            ].map((mode) => (
              <button
                key={mode.value}
                onClick={() => updateSettings({ thinking: { ...thinking, mode: mode.value } })}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                  thinking.mode === mode.value
                    ? 'bg-purple-500/20 text-purple-500'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                <mode.icon className="w-4 h-4" />
                <span className="text-xs">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Budget Slider */}
        {thinking.mode !== 'disabled' && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Budget</span>
              <span className="text-xs text-muted-foreground">{thinking.budgetTokens} tokens</span>
            </div>
            <input
              type="range"
              min="1024"
              max="16384"
              step="1024"
              value={thinking.budgetTokens}
              onChange={(e) =>
                updateSettings({ thinking: { ...thinking, budgetTokens: Number(e.target.value) } })
              }
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1K</span>
              <span>16K</span>
            </div>
          </div>
        )}

        {/* Keywords */}
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Trigger Keywords
          </button>
          {expanded && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['think', 'ultrathink', 'reason', 'analyze', 'step by step', 'carefully'].map((kw) => (
                <span
                  key={kw}
                  className="px-2 py-0.5 bg-purple-500/10 text-purple-500 rounded-full text-xs"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
