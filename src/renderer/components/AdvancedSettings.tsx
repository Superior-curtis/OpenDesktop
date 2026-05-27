import { useState } from 'react'
import { useAppStateStore } from '../store/appStateStore'
import { X, Plus, Trash2, Shield, Brain, FileText, GitBranch, Zap, Settings2, Bot, MessageSquare, Eye } from 'lucide-react'

interface AdvancedSettingsProps {
  onClose: () => void
}

const PERMISSION_MODES = [
  { value: 'default', label: 'Default', desc: 'Ask before write, bash, MCP' },
  { value: 'acceptEdits', label: 'Accept Edits', desc: 'Auto-approve file edits, ask for bash' },
  { value: 'dontAsk', label: 'Don\'t Ask', desc: 'Approve all actions' },
  { value: 'bypassPermissions', label: 'Bypass', desc: 'Skip all permission checks' },
  { value: 'auto', label: 'Auto', desc: 'AI classifier decides per action' },
]

const THINKING_MODES = [
  { value: 'off', label: 'Off', desc: 'No extended thinking' },
  { value: 'on', label: 'On', desc: 'Always use extended thinking' },
  { value: 'adaptive', label: 'Adaptive', desc: 'AI decides when to think deeply' },
]

const OUTPUT_STYLES = [
  { value: 'concise', label: 'Concise', desc: 'Brief and direct' },
  { value: 'detailed', label: 'Detailed', desc: 'Clear explanations' },
  { value: 'verbose', label: 'Verbose', desc: 'Thorough with examples' },
]

const EFFORT_LEVELS = [
  { value: 'low', label: 'Low', desc: 'Minimal explanation' },
  { value: 'medium', label: 'Medium', desc: 'Moderate detail' },
  { value: 'high', label: 'High', desc: 'Full reasoning and alternatives' },
]

const AGENT_MODELS = [
  { value: 'sonnet', label: 'Sonnet', desc: 'Balanced speed/quality' },
  { value: 'opus', label: 'Opus', desc: 'Maximum quality' },
  { value: 'haiku', label: 'Haiku', desc: 'Fast and cheap' },
]

export function AdvancedSettings({ onClose }: AdvancedSettingsProps) {
  const appState = useAppStateStore()
  const [activeSection, setActiveSection] = useState('permissions')

  const sections = [
    { id: 'permissions', icon: Shield, label: 'Permissions' },
    { id: 'thinking', icon: Brain, label: 'Thinking' },
    { id: 'context', icon: GitBranch, label: 'Context' },
    { id: 'compaction', icon: Zap, label: 'Compaction' },
    { id: 'planmode', icon: Eye, label: 'Plan Mode' },
    { id: 'memory', icon: FileText, label: 'Memory' },
    { id: 'output', icon: MessageSquare, label: 'Output' },
    { id: 'agent', icon: Bot, label: 'Agent' },
  ]

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl overflow-hidden border border-zinc-800" style={{ background: '#18181b' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Advanced Settings</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-44 border-r border-zinc-800 bg-zinc-900/50 overflow-y-auto p-2 space-y-0.5">
            {sections.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded text-xs transition-colors ${
                  activeSection === id
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Permissions */}
            {activeSection === 'permissions' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-zinc-100 mb-3">Permission Mode</h3>
                  <p className="text-xs text-zinc-500 mb-3">
                    Controls how tool execution permissions are handled. Auto mode uses an AI classifier for each action.
                  </p>
                  <div className="space-y-1.5">
                    {PERMISSION_MODES.map(({ value, label, desc }) => (
                      <button
                        key={value}
                        onClick={() => appState.setPermissionMode(value as any)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                          appState.permissionMode === value
                            ? 'border-zinc-600 bg-zinc-800'
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          appState.permissionMode === value ? 'border-purple-500' : 'border-zinc-600'
                        }`}>
                          {appState.permissionMode === value && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                        </div>
                        <div>
                          <div className="text-xs text-zinc-200">{label}</div>
                          <div className="text-[10px] text-zinc-500">{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-zinc-100 mb-3">Always Allow Tools</h3>
                  <p className="text-xs text-zinc-500 mb-2">These tools will always be allowed without asking.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'].map((tool) => (
                      <button
                        key={tool}
                        onClick={() => {
                          const current = appState.alwaysAllowTools
                          const updated = current.includes(tool)
                            ? current.filter((t) => t !== tool)
                            : [...current, tool]
                          appState.setAlwaysAllowTools(updated)
                        }}
                        className={`px-2 py-1 rounded text-xs border transition-colors ${
                          appState.alwaysAllowTools.includes(tool)
                            ? 'border-emerald-600 bg-emerald-900/30 text-emerald-400'
                            : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'
                        }`}
                      >
                        {tool}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-zinc-100 mb-3">Custom Permission Rules</h3>
                  <p className="text-xs text-zinc-500 mb-2">Add specific rules for tool patterns.</p>
                  <div className="space-y-1.5">
                    {appState.permissionRules.map((rule, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-800/50 text-xs">
                        <span className="text-zinc-300">{rule.toolName}</span>
                        <span className="text-zinc-500">{rule.pattern}</span>
                        <span className={`px-1.5 py-0.5 rounded ${
                          rule.action === 'allow' ? 'bg-emerald-900/30 text-emerald-400' :
                          rule.action === 'deny' ? 'bg-red-900/30 text-red-400' :
                          'bg-amber-900/30 text-amber-400'
                        }`}>{rule.action}</span>
                        <button
                          onClick={() => appState.removePermissionRule(i)}
                          className="ml-auto p-0.5 hover:bg-zinc-700 rounded"
                        >
                          <Trash2 className="w-3 h-3 text-zinc-500" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => appState.addPermissionRule({
                        toolName: 'Bash',
                        pattern: '*',
                        action: 'ask',
                      })}
                      className="w-full flex items-center gap-1.5 px-3 py-2 rounded border border-dashed border-zinc-700 text-xs text-zinc-500 hover:border-zinc-600"
                    >
                      <Plus className="w-3 h-3" />
                      Add Rule
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Thinking */}
            {activeSection === 'thinking' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-zinc-100 mb-3">Thinking Mode</h3>
                  <p className="text-xs text-zinc-500 mb-3">Extended thinking allows the AI to work through complex problems step by step.</p>
                  <div className="space-y-1.5">
                    {THINKING_MODES.map(({ value, label, desc }) => (
                      <button
                        key={value}
                        onClick={() => appState.setThinkingMode(value as any)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                          appState.thinkingMode === value
                            ? 'border-zinc-600 bg-zinc-800'
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          appState.thinkingMode === value ? 'border-purple-500' : 'border-zinc-600'
                        }`}>
                          {appState.thinkingMode === value && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                        </div>
                        <div>
                          <div className="text-xs text-zinc-200">{label}</div>
                          <div className="text-[10px] text-zinc-500">{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-zinc-100 mb-3">Thinking Budget</h3>
                  <p className="text-xs text-zinc-500 mb-2">Maximum tokens for extended thinking.</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={4000}
                      max={128000}
                      step={4000}
                      value={appState.thinkingBudget}
                      onChange={(e) => appState.setThinkingBudget(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs text-zinc-300 w-16 text-right">{(appState.thinkingBudget / 1000).toFixed(0)}K</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-zinc-200">Auto-Trigger Thinking</div>
                    <div className="text-[10px] text-zinc-500">AI decides when to use extended thinking</div>
                  </div>
                  <button
                    onClick={() => appState.setThinkingAutoTrigger(!appState.thinkingAutoTrigger)}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      appState.thinkingAutoTrigger ? 'bg-purple-600' : 'bg-zinc-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      appState.thinkingAutoTrigger ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            )}

            {/* Context */}
            {activeSection === 'context' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-zinc-200">Auto-Inject Git Context</div>
                      <div className="text-[10px] text-zinc-500">Inject branch, status, commits every turn</div>
                    </div>
                    <button
                      onClick={() => appState.setAutoInjectGitContext(!appState.autoInjectGitContext)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        appState.autoInjectGitContext ? 'bg-purple-600' : 'bg-zinc-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        appState.autoInjectGitContext ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-zinc-200">Auto-Inject Project Context</div>
                      <div className="text-[10px] text-zinc-500">Inject CLAUDE.md and project conventions</div>
                    </div>
                    <button
                      onClick={() => appState.setAutoInjectProjectContext(!appState.autoInjectProjectContext)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        appState.autoInjectProjectContext ? 'bg-purple-600' : 'bg-zinc-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        appState.autoInjectProjectContext ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-zinc-200">Context Cache</div>
                      <div className="text-[10px] text-zinc-500">Cache context to reduce API calls</div>
                    </div>
                    <button
                      onClick={() => appState.setContextCacheEnabled(!appState.contextCacheEnabled)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        appState.contextCacheEnabled ? 'bg-purple-600' : 'bg-zinc-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        appState.contextCacheEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-zinc-100 mb-3">CLAUDE.md</h3>
                  <p className="text-xs text-zinc-500 mb-3">Project-level conventions and instructions injected every turn.</p>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-zinc-300">Enabled</div>
                    <button
                      onClick={() => appState.setCLAUDEmd({ enabled: !appState.claudeMd.enabled })}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        appState.claudeMd.enabled ? 'bg-purple-600' : 'bg-zinc-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        appState.claudeMd.enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  <textarea
                    value={appState.claudeMd.content}
                    onChange={(e) => appState.setCLAUDEmd({ content: e.target.value })}
                    placeholder="# Project Conventions\n- Use TypeScript\n- Follow ESLint rules\n- Run tests before committing"
                    rows={6}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 resize-none font-mono"
                  />
                </div>
              </div>
            )}

            {/* Compaction */}
            {activeSection === 'compaction' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-zinc-200">Auto-Compaction</div>
                    <div className="text-[10px] text-zinc-500">Automatically summarize long conversations</div>
                  </div>
                  <button
                    onClick={() => appState.setCompactionEnabled(!appState.compactionEnabled)}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      appState.compactionEnabled ? 'bg-purple-600' : 'bg-zinc-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      appState.compactionEnabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-zinc-100 mb-3">Compaction Threshold</h3>
                  <p className="text-xs text-zinc-500 mb-2">Start compacting when context exceeds this size.</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={20000}
                      max={80000}
                      step={5000}
                      value={appState.compactionThreshold}
                      onChange={(e) => appState.setCompactionThreshold(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs text-zinc-300 w-16 text-right">{(appState.compactionThreshold / 1000).toFixed(0)}K</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-zinc-100 mb-3">Compaction Limit</h3>
                  <p className="text-xs text-zinc-500 mb-2">Force compaction when context exceeds this size.</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={40000}
                      max={120000}
                      step={5000}
                      value={appState.compactionLimit}
                      onChange={(e) => appState.setCompactionLimit(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs text-zinc-300 w-16 text-right">{(appState.compactionLimit / 1000).toFixed(0)}K</span>
                  </div>
                </div>

                <div className="rounded-lg bg-zinc-800/50 p-3 border border-zinc-800">
                  <div className="text-xs text-zinc-300 mb-1">6-Layer Compaction Pipeline</div>
                  <div className="text-[10px] text-zinc-500 space-y-0.5">
                    <div>1. Tool Result Budget - Trim oversized tool outputs</div>
                    <div>2. Snip - Lightweight local trimming</div>
                    <div>3. Microcompact - Summarize individual tool results</div>
                    <div>4. Context Collapse - Project collapsed context view</div>
                    <div>5. Autocompact - Full conversation summarization</div>
                    <div>6. Reactive Compact - Emergency recovery on API failure</div>
                  </div>
                </div>
              </div>
            )}

            {/* Plan Mode */}
            {activeSection === 'planmode' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-zinc-200">Plan Mode</div>
                    <div className="text-[10px] text-zinc-500">Require approval before executing changes</div>
                  </div>
                  <button
                    onClick={() => appState.setPlanMode({ enabled: !appState.planMode.enabled })}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      appState.planMode.enabled ? 'bg-purple-600' : 'bg-zinc-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      appState.planMode.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {appState.planMode.enabled && (
                  <div className="rounded-lg bg-zinc-800/50 p-4 border border-zinc-800">
                    <div className="text-xs text-zinc-300 mb-2">How Plan Mode Works</div>
                    <div className="text-[10px] text-zinc-500 space-y-1.5">
                      <div>1. AI proposes changes in plan mode</div>
                      <div>2. You review and approve/reject each change</div>
                      <div>3. Only approved changes are executed</div>
                      <div>4. Use /plan to enter plan mode, ExitPlanMode to leave</div>
                    </div>
                  </div>
                )}

                {appState.planMode.pendingChanges.length > 0 && (
                  <div>
                    <div className="text-xs text-zinc-200 mb-2">Pending Changes ({appState.planMode.pendingChanges.length})</div>
                    <div className="space-y-1.5">
                      {appState.planMode.pendingChanges.map((change) => (
                        <div key={change.id} className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-800/50 text-xs">
                          <div className={`w-2 h-2 rounded-full ${
                            change.risk === 'high' ? 'bg-red-400' :
                            change.risk === 'medium' ? 'bg-amber-400' :
                            'bg-emerald-400'
                          }`} />
                          <span className="text-zinc-300 flex-1">{change.description}</span>
                          <button
                            onClick={() => appState.approveChange(change.id)}
                            className="px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => appState.rejectChange(change.id)}
                            className="px-2 py-0.5 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50"
                          >
                            Reject
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Memory */}
            {activeSection === 'memory' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-zinc-200">Auto-Extract Memory</div>
                    <div className="text-[10px] text-zinc-500">AI automatically extracts important information</div>
                  </div>
                  <button
                    onClick={() => appState.setAutoExtractMemory(!appState.autoExtractMemory)}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      appState.autoExtractMemory ? 'bg-purple-600' : 'bg-zinc-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      appState.autoExtractMemory ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div>
                  <div className="text-xs text-zinc-200 mb-2">Stored Memories ({appState.memories.length})</div>
                  {appState.memories.length === 0 ? (
                    <div className="text-xs text-zinc-600 py-4 text-center">No memories stored yet</div>
                  ) : (
                    <div className="space-y-1.5">
                      {appState.memories.map((memory) => (
                        <div key={memory.id} className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-800/50 text-xs">
                          <span className={`px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400`}>{memory.category}</span>
                          <span className="text-zinc-300 flex-1 truncate">{memory.content}</span>
                          <button
                            onClick={() => appState.removeMemory(memory.id)}
                            className="p-0.5 hover:bg-zinc-700 rounded"
                          >
                            <Trash2 className="w-3 h-3 text-zinc-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-zinc-200 mb-2">Memory Categories</div>
                  <div className="flex flex-wrap gap-1.5">
                    {appState.memoryCategories.map((cat) => (
                      <span key={cat} className="px-2 py-1 rounded bg-zinc-800 text-xs text-zinc-400">{cat}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Output */}
            {activeSection === 'output' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-zinc-100 mb-3">Output Style</h3>
                  <div className="space-y-1.5">
                    {OUTPUT_STYLES.map(({ value, label, desc }) => (
                      <button
                        key={value}
                        onClick={() => appState.setOutputStyle(value as any)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                          appState.outputStyle === value
                            ? 'border-zinc-600 bg-zinc-800'
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          appState.outputStyle === value ? 'border-purple-500' : 'border-zinc-600'
                        }`}>
                          {appState.outputStyle === value && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                        </div>
                        <div>
                          <div className="text-xs text-zinc-200">{label}</div>
                          <div className="text-[10px] text-zinc-500">{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-zinc-100 mb-3">Effort Level</h3>
                  <div className="space-y-1.5">
                    {EFFORT_LEVELS.map(({ value, label, desc }) => (
                      <button
                        key={value}
                        onClick={() => appState.setEffort(value as any)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                          appState.effort === value
                            ? 'border-zinc-600 bg-zinc-800'
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          appState.effort === value ? 'border-purple-500' : 'border-zinc-600'
                        }`}>
                          {appState.effort === value && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                        </div>
                        <div>
                          <div className="text-xs text-zinc-200">{label}</div>
                          <div className="text-[10px] text-zinc-500">{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-zinc-200">Show Language in Code Blocks</div>
                      <div className="text-[10px] text-zinc-500">Display language label on code blocks</div>
                    </div>
                    <button
                      onClick={() => appState.setCodeBlockLanguage(!appState.codeBlockLanguage)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        appState.codeBlockLanguage ? 'bg-purple-600' : 'bg-zinc-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        appState.codeBlockLanguage ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-zinc-200">Show Line Numbers</div>
                      <div className="text-[10px] text-zinc-500">Display line numbers in code blocks</div>
                    </div>
                    <button
                      onClick={() => appState.setShowLineNumbers(!appState.showLineNumbers)}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        appState.showLineNumbers ? 'bg-purple-600' : 'bg-zinc-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        appState.showLineNumbers ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Agent */}
            {activeSection === 'agent' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-zinc-100 mb-3">Default Agent Model</h3>
                  <p className="text-xs text-zinc-500 mb-3">Model used for sub-agent tasks.</p>
                  <div className="space-y-1.5">
                    {AGENT_MODELS.map(({ value, label, desc }) => (
                      <button
                        key={value}
                        onClick={() => appState.setDefaultAgentModel(value)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                          appState.defaultAgentModel === value
                            ? 'border-zinc-600 bg-zinc-800'
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          appState.defaultAgentModel === value ? 'border-purple-500' : 'border-zinc-600'
                        }`}>
                          {appState.defaultAgentModel === value && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                        </div>
                        <div>
                          <div className="text-xs text-zinc-200">{label}</div>
                          <div className="text-[10px] text-zinc-500">{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-zinc-100 mb-3">Max Concurrent Agents</h3>
                  <p className="text-xs text-zinc-500 mb-2">Maximum number of sub-agents running simultaneously.</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={appState.maxConcurrentAgents}
                      onChange={(e) => appState.setMaxConcurrentAgents(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs text-zinc-300 w-8 text-right">{appState.maxConcurrentAgents}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-zinc-100 mb-3">Agent Timeout (seconds)</h3>
                  <p className="text-xs text-zinc-500 mb-2">Maximum time before an agent task is terminated.</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={60}
                      max={600}
                      step={30}
                      value={appState.agentTimeout}
                      onChange={(e) => appState.setAgentTimeout(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs text-zinc-300 w-12 text-right">{appState.agentTimeout}s</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
