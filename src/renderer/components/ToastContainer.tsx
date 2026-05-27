import { useNotificationsStore, type NotificationType } from '../store/notificationsStore'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const TYPE_CONFIG: Record<NotificationType, { icon: React.ComponentType<{ className?: string }>; bg: string; border: string; text: string }> = {
  success: { icon: CheckCircle, bg: 'bg-emerald-900/40', border: 'border-emerald-700/50', text: 'text-emerald-300' },
  error: { icon: XCircle, bg: 'bg-red-900/40', border: 'border-red-700/50', text: 'text-red-300' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-900/40', border: 'border-amber-700/50', text: 'text-amber-300' },
  info: { icon: Info, bg: 'bg-blue-900/40', border: 'border-blue-700/50', text: 'text-blue-300' },
}

export function ToastContainer() {
  const { notifications, dismissNotification } = useNotificationsStore()
  const visible = notifications.filter((n) => !n.dismissed)

  if (visible.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm">
      {visible.map((n) => {
        const cfg = TYPE_CONFIG[n.type]
        const Icon = cfg.icon
        return (
          <div
            key={n.id}
            className={`${cfg.bg} ${cfg.border} border rounded-lg px-3 py-2.5 shadow-xl animate-slide-in-up flex items-start gap-2.5`}
          >
            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.text}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-medium ${cfg.text}`}>{n.title}</div>
              {n.message && <div className="text-[10px] text-zinc-400 mt-0.5">{n.message}</div>}
            </div>
            <button onClick={() => dismissNotification(n.id)} className="p-0.5 hover:bg-white/10 rounded flex-shrink-0">
              <X className="w-3 h-3 text-zinc-500" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
