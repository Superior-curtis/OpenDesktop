import { useState } from 'react'
import { useChatStore } from '../store/chatStore'
import { X, Plus, Trash2, Key, Globe, Cpu, Sun, Moon } from 'lucide-react'

const TEMPLATES: Record<string, { name: string; url: string; model: string; type?: string }> = {
  anthropic: { name: 'Anthropic Claude', url: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514', type: 'anthropic' },
  google: { name: 'Google Gemini (Free)', url: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash', type: 'google' },
  opencode: { name: 'OpenCode Zen', url: 'https://opencode.ai/zen/v1', model: 'opencode/deepseek-v4-flash-free' },
  nvidia: { name: 'NVIDIA NIM', url: 'https://integrate.api.nvidia.com', model: 'mistralai/mistral-large-3-675b-instruct-2512' },
  openrouter: { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4' },
  openai: { name: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  bedrock: { name: 'AWS Bedrock', url: 'https://bedrock-runtime.us-east-1.amazonaws.com', model: 'us.anthropic.claude-sonnet-4-20250514-v1:0', type: 'bedrock' },
  ollama: { name: 'Ollama Local', url: 'http://localhost:11434', model: 'llama3.2' },
  custom: { name: 'Custom API', url: '', model: '' },
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { providers, addProvider, removeProvider, activeProviderId, setActiveProvider, settings, updateSettings } = useChatStore()
  const [tab, setTab] = useState<'providers' | 'general'>('providers')
  const [template, setTemplate] = useState('opencode')
  const [apiKey, setApiKey] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [customModel, setCustomModel] = useState('')

  const handleAdd = () => {
    const t = TEMPLATES[template]
    const provider: any = { id: crypto.randomUUID(), name: t.name, baseUrl: template === 'custom' ? customUrl : t.url, apiKey: apiKey || 'not-needed', model: template === 'custom' ? customModel : t.model }
    if (t.type) provider.providerType = t.type
    addProvider(provider)
    if (!activeProviderId) setActiveProvider(provider.id)
    setApiKey(''); setCustomUrl(''); setCustomModel('')
  }

  const needsKey = template !== 'ollama' && template !== 'opencode'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[480px] max-h-[80vh] bg-[#1e1e1e] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="flex gap-4">
            <button onClick={() => setTab('providers')} className={`text-sm ${tab === 'providers' ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}>Providers</button>
            <button onClick={() => setTab('general')} className={`text-sm ${tab === 'general' ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}>General</button>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'providers' && (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Add Provider</div>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {Object.entries(TEMPLATES).map(([k, t]) => (
                    <button key={k} onClick={() => setTemplate(k)} className={`px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${template === k ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800'}`}>{t.name}</button>
                  ))}
                </div>
                {template === 'custom' && (
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-zinc-600" /><input value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="Base URL" className="flex-1 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 outline-none focus:border-zinc-600" /></div>
                    <div className="flex items-center gap-2"><Cpu className="w-3.5 h-3.5 text-zinc-600" /><input value={customModel} onChange={e => setCustomModel(e.target.value)} placeholder="Model" className="flex-1 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 outline-none focus:border-zinc-600" /></div>
                  </div>
                )}
                {needsKey && (
                  <div className="flex items-center gap-2 mb-3"><Key className="w-3.5 h-3.5 text-zinc-600" /><input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API Key" className="flex-1 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 outline-none focus:border-zinc-600" /></div>
                )}
                <button onClick={handleAdd} className="w-full py-2 rounded-lg bg-zinc-200 text-zinc-900 text-sm font-medium hover:bg-white transition-colors flex items-center justify-center gap-2"><Plus className="w-3.5 h-3.5" />Add Provider</button>
              </div>
              {providers.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Active ({providers.length})</div>
                  <div className="space-y-1">
                    {providers.map(p => (
                      <div key={p.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${activeProviderId === p.id ? 'bg-zinc-800 border border-zinc-700' : 'bg-zinc-900/30 border border-transparent'}`}>
                        <button onClick={() => setActiveProvider(p.id)} className={`w-3 h-3 rounded-full border flex items-center justify-center ${activeProviderId === p.id ? 'border-zinc-300' : 'border-zinc-700'}`}>{activeProviderId === p.id && <div className="w-1.5 h-1.5 rounded-full bg-zinc-300" />}</button>
                        <div className="flex-1 min-w-0"><div className="text-sm text-zinc-300 truncate">{p.name}</div><div className="text-[10px] text-zinc-600 font-mono truncate">{p.model}</div></div>
                        <button onClick={() => removeProvider(p.id)} className="p-1 hover:bg-zinc-700 rounded text-zinc-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === 'general' && (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Theme</div>
                <div className="flex gap-2">
                  {(['dark', 'light', 'system'] as const).map(t => (
                    <button key={t} onClick={() => updateSettings({ theme: t })} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${settings.theme === t ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800'}`}>
                      {t === 'dark' ? <Moon className="w-3.5 h-3.5" /> : t === 'light' ? <Sun className="w-3.5 h-3.5" /> : 'Auto'}{t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">About</div>
                <p className="text-sm text-zinc-600 leading-relaxed">OpenDesktop — free, open-source AI assistant. Runs on Windows, macOS, Linux, and the web.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
