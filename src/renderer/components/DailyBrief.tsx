import { useState, useEffect } from 'react'
import { useChatStore } from '../store/chatStore'
import { Sun, Calendar, Mail, CheckSquare, X, Settings2 } from 'lucide-react'

interface DailyBriefProps {
  onClose: () => void
}

export function DailyBrief({ onClose }: DailyBriefProps) {
  const { setIsSettingsOpen } = useChatStore()
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 6) setGreeting('Good night')
    else if (hour < 12) setGreeting('Good morning')
    else if (hour < 18) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  const hasWeatherConfig = false
  const hasCalendarConfig = false
  const hasEmailConfig = false
  const hasTaskConfig = false

  const needsConfig = !hasWeatherConfig && !hasCalendarConfig && !hasEmailConfig && !hasTaskConfig

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden border border-zinc-800" style={{ background: '#18181b' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{greeting}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {needsConfig ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
              <Sun className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Daily Brief Not Configured</h3>
            <p className="text-xs text-zinc-500 max-w-xs mb-6">
              Connect your services to see personalized weather, calendar events, emails, and tasks every day.
            </p>
            <div className="space-y-2 w-full max-w-xs">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 text-left">
                <Sun className="w-4 h-4 text-zinc-600" />
                <div className="flex-1">
                  <div className="text-xs text-zinc-400">Weather</div>
                  <div className="text-[10px] text-zinc-600">Set your location</div>
                </div>
                <span className="text-[10px] text-zinc-700">Not set</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 text-left">
                <Calendar className="w-4 h-4 text-zinc-600" />
                <div className="flex-1">
                  <div className="text-xs text-zinc-400">Calendar</div>
                  <div className="text-[10px] text-zinc-600">Connect Google Calendar</div>
                </div>
                <span className="text-[10px] text-zinc-700">Not set</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 text-left">
                <Mail className="w-4 h-4 text-zinc-600" />
                <div className="flex-1">
                  <div className="text-xs text-zinc-400">Email</div>
                  <div className="text-[10px] text-zinc-600">Connect Gmail/Outlook</div>
                </div>
                <span className="text-[10px] text-zinc-700">Not set</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 text-left">
                <CheckSquare className="w-4 h-4 text-zinc-600" />
                <div className="flex-1">
                  <div className="text-xs text-zinc-400">Tasks</div>
                  <div className="text-[10px] text-zinc-600">Connect task provider</div>
                </div>
                <span className="text-[10px] text-zinc-700">Not set</span>
              </div>
            </div>
            <button
              onClick={() => { onClose(); setIsSettingsOpen(true) }}
              className="mt-6 px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm hover:bg-white flex items-center gap-2"
            >
              <Settings2 className="w-4 h-4" />
              Configure Services
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Content shown when services are connected */}
          </div>
        )}
      </div>
    </div>
  )
}
