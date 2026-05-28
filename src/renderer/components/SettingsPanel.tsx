import { useChatStore } from '../store/chatStore'

export function SettingsPanel() {
  const { settings, updateSettings } = useChatStore()
  const s = settings || {} as any

  return (
    <div className="p-4 space-y-5">
      <div>
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">System Prompt</label>
        <textarea
          value={s.systemPrompt || ''}
          onChange={(e) => updateSettings?.({ systemPrompt: e.target.value })}
          placeholder="Custom instructions for the AI..."
          rows={4}
          className="w-full mt-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Temperature</label>
          <input
            type="number" min={0} max={2} step={0.1}
            value={s.temperature || 0.7}
            onChange={(e) => updateSettings?.({ temperature: parseFloat(e.target.value) })}
            className="w-full mt-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Max Tokens</label>
          <input
            type="number" min={256} max={128000}
            value={s.maxTokens || 4096}
            onChange={(e) => updateSettings?.({ maxTokens: parseInt(e.target.value) })}
            className="w-full mt-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Mode</label>
        <div className="flex gap-1.5 mt-1.5">
          {['chat', 'cowork', 'code'].map((mode) => (
            <button
              key={mode}
              onClick={() => updateSettings?.({ mode: mode as any })}
              className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                (s.mode || 'chat') === mode
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Effort</label>
        <div className="flex gap-1.5 mt-1.5">
          {['low', 'medium', 'high'].map((e) => (
            <button
              key={e}
              onClick={() => updateSettings?.({ effort: e as any })}
              className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                (s.effort || 'medium') === e
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
