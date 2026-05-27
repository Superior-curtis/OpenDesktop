import { useState, useEffect } from 'react'
import {
  Monitor,
  MousePointer,
  MousePointerClick,
  Keyboard,
  Clipboard,
  FileText,
  FileEdit,
  FolderOpen,
  Globe,
  Camera,
  Code,
  Type,
  X,
  Play,
  Loader2,
  Wrench,
} from 'lucide-react'
import { Skill, SkillResult } from '../../types/skills'

const iconMap: Record<string, any> = {
  Monitor, MousePointer, MousePointerClick, Keyboard, Clipboard,
  FileText, FileEdit, FolderOpen, Globe, Camera, Code, Type, Wrench,
}

interface SkillPanelProps {
  onClose: () => void
  onSkillResult: (result: SkillResult) => void
}

export function SkillPanel({ onClose, onSkillResult }: SkillPanelProps) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null)
  const [params, setParams] = useState<Record<string, any>>({})
  const [isExecuting, setIsExecuting] = useState(false)
  const [result, setResult] = useState<SkillResult | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    loadSkills()
  }, [])

  const loadSkills = async () => {
    const skillList = await window.electron.skills.list()
    setSkills(skillList)
  }

  const handleExecute = async () => {
    if (!activeSkill) return
    setIsExecuting(true)
    setResult(null)

    try {
      const skillResult = await window.electron.skills.execute(activeSkill.id, params)
      setResult(skillResult)
      onSkillResult(skillResult)
    } catch (error) {
      setResult({
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Execution failed',
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'system', label: 'System' },
    { id: 'browser', label: 'Browser' },
    { id: 'file', label: 'File' },
    { id: 'custom', label: 'MCP' },
  ]

  const filteredSkills = filter === 'all' ? skills : skills.filter((s) => s.category === filter)
  const Icon = activeSkill ? iconMap[activeSkill.icon] || Wrench : null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Skills & Tools</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r border-border flex flex-col">
            <div className="p-3 border-b border-border">
              <div className="flex gap-1 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setFilter(cat.id); setActiveSkill(null); setResult(null) }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      filter === cat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredSkills.map((skill) => {
                const SkillIcon = iconMap[skill.icon] || Wrench
                return (
                  <button
                    key={skill.id}
                    onClick={() => { setActiveSkill(skill); setParams({}); setResult(null) }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                      activeSkill?.id === skill.id ? 'bg-secondary' : 'hover:bg-secondary/50'
                    }`}
                  >
                    <SkillIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{skill.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{skill.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeSkill ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    {Icon && <Icon className="w-6 h-6 text-primary" />}
                    <h3 className="text-lg font-semibold">{activeSkill.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{activeSkill.description}</p>
                </div>

                {activeSkill.params && activeSkill.params.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Parameters</h4>
                    {activeSkill.params.map((param: any) => (
                      <div key={param.name}>
                        <label className="text-sm font-medium flex items-center gap-2">
                          {param.name}
                          {param.required && <span className="text-destructive">*</span>}
                        </label>
                        {param.type === 'select' && param.options ? (
                          <select
                            value={params[param.name] || param.options[0]}
                            onChange={(e) => setParams({ ...params, [param.name]: e.target.value })}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {param.options.map((opt: string) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={param.type === 'number' ? 'number' : 'text'}
                            value={params[param.name] || ''}
                            onChange={(e) => setParams({ ...params, [param.name]: param.type === 'number' ? Number(e.target.value) : e.target.value })}
                            placeholder={param.description}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isExecuting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Executing...</>
                  ) : (
                    <><Play className="w-4 h-4" /> Execute</>
                  )}
                </button>

                {result && (
                  <div className={`p-4 rounded-lg border ${result.success ? 'bg-green-500/10 border-green-500/20' : 'bg-destructive/10 border-destructive/20'}`}>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${result.success ? 'bg-green-500/20 text-green-500' : 'bg-destructive/20 text-destructive'}`}>
                      {result.success ? 'SUCCESS' : 'FAILED'}
                    </span>
                    <pre className="text-sm whitespace-pre-wrap font-mono mt-2 max-h-48 overflow-y-auto">
                      {result.error || result.output}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a skill to get started</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
