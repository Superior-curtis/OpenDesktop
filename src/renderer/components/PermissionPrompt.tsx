import { Shield, Check, X, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { usePermissionStore, resolvePermission, type RiskLevel } from '../store/permissionStore'

const RISK_STYLES: Record<RiskLevel, { bg: string; border: string; text: string; icon: typeof Info }> = {
  safe: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: Info },
  moderate: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: AlertTriangle },
  dangerous: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: AlertCircle },
}

export function PermissionPrompt() {
  const pending = usePermissionStore((s) => s.pending)
  const first = pending[0]

  if (!first) return null

  const risk = RISK_STYLES[first.riskLevel]
  const RiskIcon = risk.icon

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className={`bg-background rounded-xl shadow-2xl w-full max-w-md border ${risk.border} overflow-hidden`}>
        <div className={`p-4 ${risk.bg} border-b ${risk.border}`}>
          <div className="flex items-center gap-3">
            <Shield className={`w-5 h-5 ${risk.text}`} />
            <h3 className="font-semibold">Permission Request</h3>
            <div className="ml-auto flex items-center gap-1">
              <RiskIcon className={`w-4 h-4 ${risk.text}`} />
              <span className={`text-xs font-medium ${risk.text} capitalize`}>{first.riskLevel}</span>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <span className="text-xs text-muted-foreground">Tool</span>
            <div className="font-mono text-sm mt-1">{first.toolName}</div>
          </div>

          {first.description && (
            <div>
              <span className="text-xs text-muted-foreground">Description</span>
              <p className="text-sm mt-1">{first.description}</p>
            </div>
          )}

          <div>
            <span className="text-xs text-muted-foreground">Parameters</span>
            <pre className="text-xs bg-secondary rounded-lg p-2 mt-1 overflow-auto max-h-32 font-mono">
              {JSON.stringify(first.input, null, 2)}
            </pre>
          </div>

          {pending.length > 1 && (
            <p className="text-xs text-muted-foreground">
              {pending.length - 1} more permission request{pending.length > 2 ? 's' : ''} queued
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => resolvePermission(first.id, false)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors"
            >
              <X className="w-4 h-4" />
              Deny
            </button>
            <button
              onClick={() => resolvePermission(first.id, true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium transition-colors"
            >
              <Check className="w-4 h-4" />
              Allow
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
