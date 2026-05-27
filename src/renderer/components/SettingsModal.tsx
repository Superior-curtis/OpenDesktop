import { useState, useEffect, lazy, Suspense } from 'react'
import { useChatStore } from '../store/chatStore'
import { Provider, Memory } from '../types'
import {
  X, Plus, Trash, Check, Loader2, Settings2, Moon, Sun, Monitor,
  Download, Upload, Brain, MessageSquare, Users, Code, Zap,
  Cpu, Wrench, GitBranch, ListTodo, Activity, FileCode,
  Puzzle, Eye, Terminal, ExternalLink,
} from 'lucide-react'
import { ApiClient } from '../services/ApiClient'
import { createAICouncil } from '../services/AICouncil'
import { createExternalAPIService } from '../services/ExternalAPIService'

const LazyAICouncilPanel = lazy(() => import('./AICouncilPanel').then(m => ({ default: m.AICouncilPanel })))
const LazySkillsPanel = lazy(() => import('./SkillsPanel').then(m => ({ default: m.SkillsPanel })))
const LazySubAgentsPanel = lazy(() => import('./SubAgentsPanel').then(m => ({ default: m.SubAgentsPanel })))
const LazyToolExecutionPanel = lazy(() => import('./ToolExecutionPanel').then(m => ({ default: m.ToolExecutionPanel })))
const LazyFileEditor = lazy(() => import('./FileEditor').then(m => ({ default: m.FileEditor })))
const LazyDiffViewer = lazy(() => import('./DiffViewer').then(m => ({ default: m.DiffViewer })))
const LazyTaskPanel = lazy(() => import('./TaskPanel').then(m => ({ default: m.TaskPanel })))
const LazyTodoPanel = lazy(() => import('./TodoPanel').then(m => ({ default: m.TodoPanel })))
const LazyLiveStatusBar = lazy(() => import('./LiveStatusBar').then(m => ({ default: m.LiveStatusBar })))
const LazyLSPDiagnosticsIndicator = lazy(() => import('./LSPDiagnosticsIndicator').then(m => ({ default: m.LSPDiagnosticsIndicator })))
const LazyDailyBrief = lazy(() => import('./DailyBrief').then(m => ({ default: m.DailyBrief })))
const LazyHtmlPreview = lazy(() => import('./HtmlPreview').then(m => ({ default: m.HtmlPreview })))
const LazyPdfPreview = lazy(() => import('./PdfPreview').then(m => ({ default: m.PdfPreview })))
const LazyExternalAPIsSettings = lazy(() => import('./ExternalAPIsSettings').then(m => ({ default: m.ExternalAPIsSettings })))
const LazyAdvancedSettings = lazy(() => import('./AdvancedSettings').then(m => ({ default: m.AdvancedSettings })))

const PROVIDER_TEMPLATES: Record<string, Omit<Provider, 'id' | 'apiKey'>> = {
  'opencode-zen': { name: 'OpenCode Zen', baseUrl: 'https://opencode.ai/zen/v1', model: 'opencode/deepseek-v4-flash-free' },
  'nvidia-nim': { name: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com', model: 'mistralai/mistral-large-3-675b-instruct-2512' },
  litellm: { name: 'LiteLLM (Local Proxy)', baseUrl: 'http://localhost:4000/v1', model: 'gpt-4o-mini' },
  ollama: { name: 'Ollama (Local)', baseUrl: 'http://localhost:11434', model: 'llama3.2' },
  'lm-studio': { name: 'LM Studio', baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
  openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  custom: { name: 'Custom', baseUrl: '', model: '' },
}

export function SettingsModal() {
  const {
    setIsSettingsOpen, providers, addProvider, removeProvider,
    activeProviderId, setActiveProvider, settings, updateSettings,
    conversations, addMemory, removeMemory,
  } = useChatStore()

  const isDev = settings.developerMode
  const [activeTab, setActiveTab] = useState('general')
  const [selectedTemplate, setSelectedTemplate] = useState('opencode-zen')
  const [apiKey, setApiKey] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [newMemory, setNewMemory] = useState({ content: '', category: 'fact' as Memory['category'] })

  const userTabs = [
    { id: 'general', label: 'General', icon: Settings2 },
    { id: 'providers', label: 'Providers', icon: Zap },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'data', label: 'Data', icon: Download },
  ]

  const devTabs = [
    { id: 'developer', label: 'Developer', icon: Cpu },
  ]

  const tabs = [...userTabs, ...(isDev ? devTabs : [])]

  const devPanels = [
    { id: 'thinking', label: 'Thinking', icon: Zap },
    { id: 'ai-council', label: 'AI Council', icon: Users },
    { id: 'skills', label: 'Skills', icon: Puzzle },
    { id: 'sub-agents', label: 'Sub-Agents', icon: Terminal },
    { id: 'tool-execution', label: 'Tool Execution', icon: Wrench },
    { id: 'tasks', label: 'Tasks', icon: ListTodo },
    { id: 'todos', label: 'Todos', icon: Check },
    { id: 'mcp', label: 'MCP', icon: Settings2 },
    { id: 'file-editor', label: 'File Editor', icon: FileCode },
    { id: 'diff-viewer', label: 'Diff Viewer', icon: GitBranch },
    { id: 'live-status', label: 'Live Status', icon: Activity },
    { id: 'lsp', label: 'LSP', icon: Activity },
    { id: 'daily-brief', label: 'Daily Brief', icon: MessageSquare },
    { id: 'html-preview', label: 'HTML Preview', icon: Eye },
    { id: 'pdf-preview', label: 'PDF Preview', icon: Eye },
    { id: 'external-apis', label: 'External APIs', icon: ExternalLink },
    { id: 'advanced', label: 'Advanced', icon: Settings2 },
  ]

  const [activeDevPanel, setActiveDevPanel] = useState('thinking')

  const aiCouncil = createAICouncil()
  const externalAPIService = createExternalAPIService()
  const closeDevPanel = () => setIsSettingsOpen(false)

  const DevPanelFallback = () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
    </div>
  )

  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    if (settings.theme === 'dark') {
      root.classList.add('dark')
      root.style.colorScheme = 'dark'
      body.style.background = '#09090b'
      body.style.color = '#fafafa'
    } else if (settings.theme === 'light') {
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
      body.style.background = '#ffffff'
      body.style.color = '#09090b'
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
      root.style.colorScheme = prefersDark ? 'dark' : 'light'
      body.style.background = prefersDark ? '#09090b' : '#ffffff'
      body.style.color = prefersDark ? '#fafafa' : '#09090b'
    }
  }, [settings.theme])

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

  const handleAddMemory = () => {
    if (!newMemory.content.trim()) return
    addMemory({ id: crypto.randomUUID(), content: newMemory.content, category: newMemory.category, createdAt: Date.now() })
    setNewMemory({ content: '', category: 'fact' })
  }

  const handleExport = () => {
    const data = JSON.stringify({ conversations }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `opendesktop-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const imported = JSON.parse(await file.text())
        if (imported.conversations) {
          useChatStore.setState({ conversations: imported.conversations, activeConversationId: imported.conversations[0]?.id || null, messages: imported.conversations[0]?.messages || [] })
        }
      } catch { alert('Invalid file') }
    }
    input.click()
  }

  const modeIcons = { chat: MessageSquare, cowork: Users, code: Code }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl overflow-hidden border border-zinc-800" style={{ background: '#18181b' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Dev</span>
              <button
                onClick={() => updateSettings({ developerMode: !settings.developerMode })}
                className={`w-9 h-5 rounded-full relative transition-colors ${settings.developerMode ? 'bg-purple-600' : 'bg-zinc-700'}`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.developerMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <button onClick={() => setIsSettingsOpen(false)} className="p-1.5 hover:bg-zinc-800 rounded-lg">
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-zinc-100 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* ── General ── */}
          {activeTab === 'general' && (
            <>
              <section>
                <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Theme</h3>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'dark' as const, label: 'Dark', icon: Moon },
                    { value: 'light' as const, label: 'Light', icon: Sun },
                    { value: 'system' as const, label: 'System', icon: Monitor },
                  ]).map((t) => (
                    <button
                      key={t.value}
                      onClick={() => updateSettings({ theme: t.value })}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm transition-colors ${
                        settings.theme === t.value ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      <t.icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Font Size</h3>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'small' as const, label: 'Small' },
                    { value: 'medium' as const, label: 'Medium' },
                    { value: 'large' as const, label: 'Large' },
                  ]).map((s) => (
                    <button
                      key={s.value}
                      onClick={() => updateSettings({ fontSize: s.value })}
                      className={`py-2 rounded-lg text-sm transition-colors ${
                        settings.fontSize === s.value ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Send Shortcut</h3>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'enter' as const, label: 'Enter' },
                    { value: 'ctrl-enter' as const, label: 'Ctrl + Enter' },
                  ]).map((s) => (
                    <button
                      key={s.value}
                      onClick={() => updateSettings({ sendShortcut: s.value })}
                      className={`py-2 rounded-lg text-sm transition-colors ${
                        settings.sendShortcut === s.value ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </section>

              {isDev && (
                <section>
                  <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Mode</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {(['chat', 'cowork', 'code'] as const).map((mode) => {
                      const Icon = modeIcons[mode]
                      return (
                        <button
                          key={mode}
                          onClick={() => updateSettings({ mode })}
                          className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-colors ${
                            settings.mode === mode ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ── Providers ── */}
          {activeTab === 'providers' && (
            <>
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
                    <input
                      type="text" value={customBaseUrl} onChange={(e) => setCustomBaseUrl(e.target.value)}
                      placeholder="Base URL"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                    />
                    <input
                      type="text" value={customModel} onChange={(e) => setCustomModel(e.target.value)}
                      placeholder="Model name"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                )}

                {selectedTemplate !== 'ollama' && selectedTemplate !== 'lm-studio' && (
                  <input
                    type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                    placeholder="API Key"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 mb-3"
                  />
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
                  <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Active Provider</h3>
                  <div className="space-y-1">
                    {providers.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50">
                        <button
                          onClick={() => setActiveProvider(p.id)}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${activeProviderId === p.id ? 'border-zinc-100 bg-zinc-100' : 'border-zinc-600'}`}>
                            {activeProviderId === p.id && <Check className="w-2.5 h-2.5 text-zinc-900" />}
                          </div>
                          <div>
                            <div className="text-sm text-zinc-200">{p.name}</div>
                            <div className="text-xs text-zinc-500">{p.model}</div>
                          </div>
                        </button>
                        <button onClick={() => removeProvider(p.id)} className="p-1 hover:bg-zinc-700 rounded">
                          <Trash className="w-3.5 h-3.5 text-zinc-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ── Memory ── */}
          {activeTab === 'memory' && (
            <>
              <section>
                <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Add Memory</h3>
                <textarea
                  value={newMemory.content} onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                  placeholder="What should the AI remember?"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 resize-none min-h-[60px] mb-2"
                />
                <div className="flex gap-2">
                  <select
                    value={newMemory.category} onChange={(e) => setNewMemory({ ...newMemory, category: e.target.value as Memory['category'] })}
                    className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none"
                  >
                    <option value="fact">Fact</option>
                    <option value="preference">Preference</option>
                    <option value="instruction">Instruction</option>
                  </select>
                  <button
                    onClick={handleAddMemory}
                    className="flex-1 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm hover:bg-white flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </section>

              {settings.memories.length > 0 && (
                <section>
                  <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
                    Memories ({settings.memories.length})
                  </h3>
                  <div className="space-y-1">
                    {settings.memories.map((m) => (
                      <div key={m.id} className="flex items-start justify-between px-3 py-2 rounded-lg bg-zinc-800/50">
                        <div className="flex-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            m.category === 'fact' ? 'bg-blue-500/15 text-blue-400' :
                            m.category === 'preference' ? 'bg-purple-500/15 text-purple-400' :
                            'bg-amber-500/15 text-amber-400'
                          }`}>{m.category}</span>
                          <p className="text-sm text-zinc-300 mt-1">{m.content}</p>
                        </div>
                        <button onClick={() => removeMemory(m.id)} className="p-1 ml-2 hover:bg-zinc-700 rounded">
                          <Trash className="w-3.5 h-3.5 text-zinc-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ── Data ── */}
          {activeTab === 'data' && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleExport} className="flex flex-col items-center gap-2 p-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
                <Download className="w-5 h-5 text-zinc-400" />
                <span className="text-sm text-zinc-200">Export</span>
                <span className="text-xs text-zinc-500">{conversations.length} chats</span>
              </button>
              <button onClick={handleImport} className="flex flex-col items-center gap-2 p-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
                <Upload className="w-5 h-5 text-zinc-400" />
                <span className="text-sm text-zinc-200">Import</span>
                <span className="text-xs text-zinc-500">From JSON</span>
              </button>
            </div>
          )}

          {/* ── Developer ── */}
          {activeTab === 'developer' && isDev && (
            <div className="flex gap-4 min-h-[300px]">
              {/* Sub-navigation */}
              <div className="w-40 flex-shrink-0 space-y-0.5">
                {devPanels.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActiveDevPanel(p.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                      activeDevPanel === p.id
                        ? 'bg-zinc-700/70 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                    }`}
                  >
                    <p.icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Panel content */}
              <div className="flex-1 min-w-0">
                <Suspense fallback={<DevPanelFallback />}>
                  {activeDevPanel === 'thinking' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800">
                        <div>
                          <div className="text-sm text-zinc-200">Enable Thinking</div>
                          <div className="text-xs text-zinc-500">AI thinks before responding</div>
                        </div>
                        <button
                          onClick={() => updateSettings({ thinking: { ...settings.thinking, enabled: !settings.thinking.enabled } })}
                          className={`w-9 h-5 rounded-full relative transition-colors ${settings.thinking.enabled ? 'bg-purple-600' : 'bg-zinc-700'}`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.thinking.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                      {settings.thinking.enabled && (
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { value: 'adaptive' as const, label: 'Adaptive' },
                            { value: 'ultrathink' as const, label: 'Deep' },
                            { value: 'disabled' as const, label: 'Off' },
                          ]).map((m) => (
                            <button
                              key={m.value}
                              onClick={() => updateSettings({ thinking: { ...settings.thinking, mode: m.value } })}
                              className={`py-2 rounded-lg text-sm transition-colors ${
                                settings.thinking.mode === m.value ? 'bg-purple-600/20 text-purple-400' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {activeDevPanel === 'ai-council' && <LazyAICouncilPanel council={aiCouncil} />}
                  {activeDevPanel === 'skills' && <LazySkillsPanel />}
                  {activeDevPanel === 'sub-agents' && <LazySubAgentsPanel onClose={closeDevPanel} />}
                  {activeDevPanel === 'tool-execution' && <LazyToolExecutionPanel onClose={closeDevPanel} />}
                  {activeDevPanel === 'tasks' && <LazyTaskPanel onClose={closeDevPanel} />}
                  {activeDevPanel === 'todos' && <LazyTodoPanel onClose={closeDevPanel} />}
                  {activeDevPanel === 'mcp' && (
                    <div className="text-center py-12 text-zinc-500 text-sm">
                      MCP servers configuration coming soon
                    </div>
                  )}
                  {activeDevPanel === 'file-editor' && <LazyFileEditor onClose={closeDevPanel} />}
                  {activeDevPanel === 'diff-viewer' && <LazyDiffViewer onClose={closeDevPanel} />}
                  {activeDevPanel === 'live-status' && <LazyLiveStatusBar />}
                  {activeDevPanel === 'lsp' && <LazyLSPDiagnosticsIndicator />}
                  {activeDevPanel === 'daily-brief' && <LazyDailyBrief onClose={closeDevPanel} />}
                  {activeDevPanel === 'html-preview' && <LazyHtmlPreview onClose={closeDevPanel} />}
                  {activeDevPanel === 'pdf-preview' && <LazyPdfPreview onClose={closeDevPanel} />}
                  {activeDevPanel === 'external-apis' && <LazyExternalAPIsSettings externalAPIService={externalAPIService} />}
                  {activeDevPanel === 'advanced' && <LazyAdvancedSettings onClose={closeDevPanel} />}
                </Suspense>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
