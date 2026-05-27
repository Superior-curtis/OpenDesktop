export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  provider?: string
  toolCallId?: string
  toolName?: string
  isThinking?: boolean
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  providerId?: string
  mode: 'chat' | 'cowork' | 'code'
  contextTokens: number
}

export interface Provider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  availableModels?: string[]
  providerType?: 'openai-compatible' | 'anthropic' | 'bedrock' | 'google'
}

export interface Memory {
  id: string
  content: string
  category: 'fact' | 'preference' | 'instruction' | 'context'
  createdAt: number
  source?: string
}

export interface MCPConfig {
  id: string
  name: string
  command: string
  args: string
  env?: Record<string, string>
  enabled: boolean
}

export interface ThinkingState {
  enabled: boolean
  mode: 'adaptive' | 'ultrathink' | 'disabled'
  budgetTokens: number
  isThinking: boolean
  thinkingContent: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: SkillResult
  timestamp: number
}

export interface SkillResult {
  success: boolean
  output: string
  error?: string
  data?: any
}

export interface AppState {
  thinking: ThinkingState
  mcpServers: MCPConfig[]
  mcpTools: any[]
  memories: Memory[]
  systemContext: {
    gitStatus?: string
    currentDate: string
    os: string
    cwd: string
  }
  costTracking: {
    totalTokens: number
    totalCost: number
    sessionTokens: number
  }
}

export interface Settings {
  theme: 'light' | 'dark' | 'system'
  autoSave: boolean
  maxTokens: number
  temperature: number
  fontSize: 'small' | 'medium' | 'large'
  sendShortcut: 'enter' | 'ctrl-enter'
  mode: 'chat' | 'cowork' | 'code'
  systemPrompt: string
  memories: Memory[]
  mcpServers: MCPConfig[]
  autoUseMCP: boolean
  thinking: ThinkingState
  effort: 'low' | 'medium' | 'high'
  outputStyle: 'concise' | 'detailed' | 'verbose'
  developerMode: boolean
  permissionMode: 'auto' | 'ask' | 'manual'
}

export interface ClaudeCodeTool {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, any>
    required: string[]
  }
}

export interface ToolResult {
  success: boolean
  output: string
  error?: string
  metadata?: Record<string, any>
}

export interface PermissionRequest {
  requestId: string
  toolName: string
  params: Record<string, any>
  riskLevel: 'safe' | 'moderate' | 'dangerous'
}

export interface PermissionRule {
  toolName: string
  mode: 'auto' | 'ask' | 'manual'
  riskThreshold: 'safe' | 'moderate' | 'dangerous'
}

export interface SystemContext {
  currentDate: string
  os: string
  platform: string
  arch: string
  nodeVersion: string
  cwd: string
  homeDir: string
  tempDir: string
  gitStatus?: string
  gitBranch?: string
  gitLog?: string
  isGitRepo: boolean
  workspacePath: string
}

// ============================================================================
// RichMessage Parts (re-exported from MessageParts.ts)
// ============================================================================

export type { RichMessage, MessagePart } from '../services/MessageParts'
