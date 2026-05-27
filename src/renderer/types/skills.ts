export interface Skill {
  id: string
  name: string
  description: string
  icon: string
  category: 'system' | 'browser' | 'file' | 'custom'
  execute: (params: Record<string, any>) => Promise<SkillResult>
  params?: SkillParam[]
}

export interface SkillParam {
  name: string
  type: 'string' | 'number' | 'boolean' | 'select'
  description: string
  required?: boolean
  options?: string[]
}

export interface SkillResult {
  success: boolean
  output: string
  error?: string
  data?: any
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: SkillResult
  timestamp: number
}
