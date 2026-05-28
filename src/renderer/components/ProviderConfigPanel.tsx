import { useState } from 'react'
import { useChatStore } from '../store/chatStore'
import { Plus, Trash2, Key, Globe, Cpu, CheckCircle } from 'lucide-react'

const TEMPLATES: Record<string, any> = {
  anthropic: { name: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514', providerType: 'anthropic' },
  bedrock: { name: 'AWS Bedrock', baseUrl: 'bedrock-runtime.us-east-1', model: 'us.anthropic.claude-sonnet-4-20250514-v1:0', providerType: 'bedrock' },
  openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  openrouter: { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4' },
  ollama: { name: 'Ollama (Local)', baseUrl: 'http://localhost:11434', model: 'llama3.2' },
  'lm-studio': { name: 'LM Studio', baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
  custom: { name: 'Custom', baseUrl: '', model: '' },
}

export function ProviderConfigPanel() {
  const { providers, addProvider, removeProvider, activeProviderId, setActiveProvider } = useChatStore()
  const [template, setTemplate] = useState('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')

  const t = TEMPLATES[template]
  const finalUrl = template === 'custom' ? baseUrl : t.baseUrl
  const finalModel = template === 'custom' ? model : t.model
  const needsKey = !['ollama', 'lm-studio'].includes(template)

  const handleAdd = () => {
    const p: any = {
      id: crypto.randomUUID(),
      name: t.name,
      baseUrl: finalUrl,
      apiKey,
      model: finalModel,
    }
    if (t.providerType) p.providerType = t.providerType
    addProvider(p)
    setApiKey('')
  }

  return (
    <div className="p-4 space-y-5">
      {/* Template selector */}
      <div>
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Provider</label>
        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          {Object.entries(TEMPLATES).map(([k, v]: any) => (
            <button
              key={k}
              onClick={() => { setTemplate(k); setBaseUrl(''); setModel('') }}
              className={`px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                template === k ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>
      </div>

      {/* URL / Model */}
      {template === 'custom' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Base URL"
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600" />
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model name"
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600" />
          </div>
        </div>
      )}

      {/* API Key */}
      {needsKey && (
        <div className="flex items-center gap-2">
          <Key className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="API Key"
            className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600" />
        </div>
      )}

      <button onClick={handleAdd}
        disabled={needsKey && !apiKey}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors disabled:opacity-30">
        <Plus className="w-4 h-4" /> Add Provider
      </button>

      {/* Provider list */}
      {providers.length > 0 && (
        <div className="border-t border-zinc-800 pt-4">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Active</h3>
          <div className="space-y-1">
            {providers.map((p: any) => (
              <button
                key={p.id}
                onClick={() => setActiveProvider(p.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeProviderId === p.id
                    ? 'bg-zinc-800 text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {activeProviderId === p.id && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                  <span className="truncate">{p.name}</span>
                  <span className="text-xs text-zinc-600 truncate">({p.model})</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeProvider(p.id) }}
                  className="p-1 rounded hover:bg-zinc-700 text-zinc-600 hover:text-red-400 flex-shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
