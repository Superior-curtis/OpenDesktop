import { useState, useEffect } from 'react'
import { X, Terminal, FileText, Search, Globe, Play, Check, AlertCircle, Loader2 } from 'lucide-react'
import { ClaudeCodeTool, ToolResult } from '../types'

export function ToolExecutionPanel({ onClose }: { onClose: () => void }) {
  const [tools, setTools] = useState<ClaudeCodeTool[]>([])
  const [selectedTool, setSelectedTool] = useState<ClaudeCodeTool | null>(null)
  const [params, setParams] = useState<Record<string, any>>({})
  const [result, setResult] = useState<ToolResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [cwd, setCwd] = useState('')

  useEffect(() => {
    window.electron.tools.list().then(setTools)
    window.electron.context.getSystem().then((ctx) => setCwd(ctx.cwd))
  }, [])

  const handleExecute = async () => {
    if (!selectedTool) return
    setLoading(true)
    setResult(null)

    try {
      const res = await window.electron.tools.execute(selectedTool.name, params, cwd)
      setResult(res)
    } catch (error) {
      setResult({
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setLoading(false)
    }
  }

  const toolIcons: Record<string, any> = {
    Bash: Terminal,
    FileRead: FileText,
    FileWrite: FileText,
    FileEdit: FileText,
    Glob: Search,
    Grep: Search,
    WebFetch: Globe,
    WebSearch: Globe,
    Task: Play,
    TaskStop: X,
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold">Claude Code Tools</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Tool List */}
          <div className="w-64 border-r border-border overflow-y-auto">
            {tools.map((tool) => {
              const Icon = toolIcons[tool.name] || Terminal
              return (
                <button
                  key={tool.name}
                  onClick={() => {
                    setSelectedTool(tool)
                    setParams({})
                    setResult(null)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border ${
                    selectedTool?.name === tool.name
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-secondary'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{tool.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{tool.description}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Tool Execution */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedTool ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedTool.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{selectedTool.description}</p>
                </div>

                <div className="space-y-3">
                  {Object.entries(selectedTool.parameters.properties).map(([key, prop]: [string, any]) => (
                    <div key={key}>
                      <label className="text-sm font-medium flex items-center gap-1">
                        {key}
                        {selectedTool.parameters.required.includes(key) && (
                          <span className="text-red-400">*</span>
                        )}
                      </label>
                      <p className="text-xs text-muted-foreground mb-1">{prop.description}</p>
                      {prop.enum ? (
                        <select
                          value={params[key] || ''}
                          onChange={(e) => setParams({ ...params, [key]: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">Select...</option>
                          {prop.enum.map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : prop.type === 'number' ? (
                        <input
                          type="number"
                          value={params[key] || ''}
                          onChange={(e) => setParams({ ...params, [key]: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      ) : (
                        <input
                          type="text"
                          value={params[key] || ''}
                          onChange={(e) => setParams({ ...params, [key]: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleExecute}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Execute
                    </>
                  )}
                </button>

                {result && (
                  <div className={`rounded-lg border p-3 ${result.success ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {result.success ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-sm font-medium">{result.success ? 'Success' : 'Failed'}</span>
                    </div>
                    {result.output && (
                      <pre className="text-xs bg-secondary rounded p-2 overflow-auto max-h-48 font-mono whitespace-pre-wrap">
                        {result.output}
                      </pre>
                    )}
                    {result.error && (
                      <p className="text-xs text-red-400 mt-2 font-mono">{result.error}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a tool to execute
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
