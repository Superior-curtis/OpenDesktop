import { useState, useCallback } from 'react'
import { useChatStore } from '../store/chatStore'
import { Provider } from '../types'
import { ApiClient } from '../services/ApiClient'
import { Zap, Plus, Trash2, Loader2, Key, Globe, Cpu } from 'lucide-react'

const PROVIDER_TEMPLATES: Record<string, Omit<Provider, 'id' | 'apiKey'>> = {
  'opencode-zen': { name: 'OpenCode Zen', baseUrl: 'https://opencode.ai/zen/v1', model: 'opencode/deepseek-v4-flash-free' },
  'nvidia-nim': { name: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com', model: 'mistralai/mistral-large-3-675b-instruct-2512' },
  litellm: { name: 'LiteLLM (Local Proxy)', baseUrl: 'http://localhost:4000/v1', model: 'gpt-4o-mini' },
  ollama: { name: 'Ollama (Local)', baseUrl: 'http://localhost:11434', model: 'llama3.2' },
  'lm-studio': { name: 'LM Studio', baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
  openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  custom: { name: 'Custom', baseUrl: '', model: '' },
}

export function ProviderConfigPanel() {
  const { providers, addProvider, removeProvider, activeProviderId, setActiveProvider, updateProvider } = useChatStore()
  const [selectedTemplate, setSelectedTemplate] = useState('opencode-zen')
  const [apiKey, setApiKey] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [editingProvider, setEditingProvider] = useState<string | null>(null)

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    const template = PROVIDER_TEMPLATES[selectedTemplate]
    const provider: Provider = {
      id: 'test', name: 'Test',
      baseUrl: selectedTemplate === 'custom' ? customBaseUrl : template.baseUrl,
      apiKey: apiKey || 'test',
      model: selectedTemplate === 'custom' ? customModel : template.model,
    }
    try {
      const client = new ApiClient(provider)
      const result = await client.testConnection()
      setTestResult({ success: result.success, message: result.success ? 'Connected!' : result.error || 'Failed' })
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : 'Failed' })
    } finally {
      setIsTesting(false)
    }
  }

  const handleAddProvider = async () => {
    const template = PROVIDER_TEMPLATES[selectedTemplate]
    const newProvider = {
      id: crypto.randomUUID(),
      name: selectedTemplate === 'custom' ? 'Custom' : template.name,
      baseUrl: selectedTemplate === 'custom' ? customBaseUrl : template.baseUrl,
      apiKey,
      model: selectedTemplate === 'custom' ? customModel : template.model,
    }
    addProvider(newProvider)
    setActiveProvider(newProvider.id)
    setApiKey('')
    setCustomBaseUrl('')
    setCustomModel('')
    setTestResult(null)
  }

  const handleModelChange = useCallback((id: string, model: string) => {
    updateProvider(id, { model })
  }, [updateProvider])

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
        <Zap className="w-4 h-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-100">Provider Configuration</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Add Provider</h3>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {Object.entries(PROVIDER_TEMPLATES).map(([key, t]) => (
              <button
                key={key}
                onClick={() => setSelectedTemplate(key)}
                className={`px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  selectedTemplate === key ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          {selectedTemplate === 'custom' && (
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text" value={customBaseUrl} onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="Base URL"
                  className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text" value={customModel} onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="Model name"
                  className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>
          )}

          {selectedTemplate !== 'ollama' && selectedTemplate !== 'lm-studio' && (
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-3.5 h-3.5 text-zinc-500" />
              <input
                type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                placeholder="API Key"
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleTestConnection} disabled={isTesting}
              className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test'}
            </button>
            <button
              onClick={handleAddProvider}
              className="flex-1 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm hover:bg-white flex items-center justify-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {testResult && (
            <div className={`mt-2 px-3 py-2 rounded-lg text-xs ${testResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {testResult.message}
            </div>
          )}
        </section>

        {providers.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Configured Providers ({providers.length})</h3>
            <div className="space-y-1.5">
              {providers.map((p) => (
                <div key={p.id} className="px-3 py-2 rounded-lg bg-zinc-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${activeProviderId === p.id ? 'border-zinc-100' : 'border-zinc-600'}`}>
                        {activeProviderId === p.id && <div className="w-1.5 h-1.5 rounded-full bg-zinc-100" />}
                      </div>
                      <span className="text-sm text-zinc-200">{p.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditingProvider(editingProvider === p.id ? null : p.id)} className="p-1 hover:bg-zinc-700 rounded">
                        <Cpu className="w-3 h-3 text-zinc-500" />
                      </button>
                      <button onClick={() => removeProvider(p.id)} className="p-1 hover:bg-zinc-700 rounded">
                        <Trash2 className="w-3 h-3 text-zinc-500" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 text-[10px] text-zinc-500 font-mono">
                    <span className="truncate max-w-[120px]">{p.baseUrl}</span>
                    <span className="text-zinc-700">|</span>
                    <span>{p.model}</span>
                  </div>

                  {editingProvider === p.id && (
                    <div className="mt-2 pt-2 border-t border-zinc-700">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">Model:</span>
                        <input
                          type="text" value={p.model}
                          onChange={(e) => handleModelChange(p.id, e.target.value)}
                          className="flex-1 px-2 py-1 rounded bg-zinc-700 border border-zinc-600 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                        />
                        {activeProviderId !== p.id && (
                          <button onClick={() => setActiveProvider(p.id)} className="px-2 py-1 rounded text-[10px] bg-zinc-700 text-zinc-300 hover:bg-zinc-600">
                            Activate
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
