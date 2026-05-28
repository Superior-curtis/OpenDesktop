import { useState, useEffect } from 'react'
import { ViewSwitcher } from './ViewSwitcher'
import { ChatArea } from './ChatArea'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 300)
    return () => clearTimeout(t)
  }, [])

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 animate-pulse" />
          <span className="text-zinc-600 text-sm font-mono">OpenDesktop</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-zinc-100">
      <ViewSwitcher />
      <ChatArea />
    </div>
  )
}
