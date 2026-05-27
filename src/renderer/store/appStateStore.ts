import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ExternalAPIs } from '../services/ExternalAPIService'

export type PermissionMode = 'default' | 'acceptEdits' | 'dontAsk' | 'bypassPermissions' | 'auto'

export type ThinkingMode = 'off' | 'on' | 'adaptive'

export interface PermissionRule {
  toolName: string
  pattern: string
  action: 'allow' | 'deny' | 'ask'
}

export interface MemoryEntry {
  id: string
  content: string
  category: string
  source: 'user' | 'auto' | 'skill'
  createdAt: number
  lastAccessed: number
  accessCount: number
}

export interface CLAUDEmdConfig {
  enabled: boolean
  paths: string[]
  autoGenerate: boolean
  content: string
}

export interface PlanModeState {
  enabled: boolean
  pendingChanges: PlanChange[]
  approvedChanges: string[]
}

export interface PlanChange {
  id: string
  type: 'file_edit' | 'bash' | 'mcp' | 'agent'
  description: string
  risk: 'low' | 'medium' | 'high'
  file?: string
  diff?: string
  command?: string
}

export interface QueryEngineConfig {
  maxTurns: number
  maxBudgetUsd: number
  costPer1KTokens: number
  compactReserveTokens: number
}

export interface AICouncilConfig {
  enabled: boolean
  maxRounds: number
  votingThreshold: number
  enableConsensus: boolean
  enableDebate: boolean
  autoTriggerForComplexity: boolean
  complexityThreshold: number
}

export interface FrustrationDetectionConfig {
  enabled: boolean
  keywords: string[]
  triggerThreshold: number
}

export interface AppState {
  // Permission system
  permissionMode: PermissionMode
  permissionRules: PermissionRule[]
  alwaysAllowTools: string[]
  alwaysDenyTools: string[]

  // Thinking mode
  thinkingMode: ThinkingMode
  thinkingBudget: number
  thinkingAutoTrigger: boolean

  // Memory system
  memories: MemoryEntry[]
  autoExtractMemory: boolean
  memoryCategories: string[]

  // CLAUDE.md
  claudeMd: CLAUDEmdConfig

  // Plan mode
  planMode: PlanModeState

  // Context injection
  autoInjectGitContext: boolean
  autoInjectProjectContext: boolean
  contextCacheEnabled: boolean

  // Compaction
  compactionEnabled: boolean
  compactionThreshold: number
  compactionLimit: number

  // Output
  outputStyle: 'concise' | 'detailed' | 'verbose'
  effort: 'low' | 'medium' | 'high'
  codeBlockLanguage: boolean
  showLineNumbers: boolean

  // Agent
  defaultAgentModel: string
  maxConcurrentAgents: number
  agentTimeout: number

  // Query Engine
  queryEngine: QueryEngineConfig

  // AI Council
  aiCouncil: AICouncilConfig

  // External APIs
  externalAPIs: ExternalAPIs

  // Frustration Detection
  frustrationDetection: FrustrationDetectionConfig

  // Actions
  setPermissionMode: (mode: PermissionMode) => void
  addPermissionRule: (rule: PermissionRule) => void
  removePermissionRule: (index: number) => void
  setAlwaysAllowTools: (tools: string[]) => void
  setAlwaysDenyTools: (tools: string[]) => void

  setThinkingMode: (mode: ThinkingMode) => void
  setThinkingBudget: (budget: number) => void
  setThinkingAutoTrigger: (enabled: boolean) => void

  addMemory: (memory: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>) => void
  removeMemory: (id: string) => void
  setAutoExtractMemory: (enabled: boolean) => void

  setCLAUDEmd: (config: Partial<CLAUDEmdConfig>) => void

  setPlanMode: (state: Partial<PlanModeState>) => void
  addPendingChange: (change: Omit<PlanChange, 'id'>) => void
  approveChange: (id: string) => void
  rejectChange: (id: string) => void
  clearPendingChanges: () => void

  setAutoInjectGitContext: (enabled: boolean) => void
  setAutoInjectProjectContext: (enabled: boolean) => void
  setContextCacheEnabled: (enabled: boolean) => void

  setCompactionEnabled: (enabled: boolean) => void
  setCompactionThreshold: (threshold: number) => void
  setCompactionLimit: (limit: number) => void

  setOutputStyle: (style: 'concise' | 'detailed' | 'verbose') => void
  setEffort: (effort: 'low' | 'medium' | 'high') => void
  setCodeBlockLanguage: (enabled: boolean) => void
  setShowLineNumbers: (enabled: boolean) => void

  setDefaultAgentModel: (model: string) => void
  setMaxConcurrentAgents: (count: number) => void
  setAgentTimeout: (timeout: number) => void

  setQueryEngineConfig: (config: Partial<QueryEngineConfig>) => void

  setAICouncilConfig: (config: Partial<AICouncilConfig>) => void

  setExternalAPIs: (config: Partial<ExternalAPIs>) => void

  setFrustrationDetection: (config: Partial<FrustrationDetectionConfig>) => void
}

const defaultMemories: MemoryEntry[] = []
const defaultRules: PermissionRule[] = []

const defaultExternalAPIs: ExternalAPIs = {
  weather: {
    enabled: false,
    apiKey: '',
    provider: 'openweather',
    defaultLocation: '',
    units: 'metric',
  },
  webSearch: {
    enabled: false,
    provider: 'firecrawl',
    apiKey: '',
    maxResults: 5,
  },
  customEndpoints: [],
}

export const useAppStateStore = create<AppState>()(
  persist(
    (set) => ({
      // Permission system
      permissionMode: 'default',
      permissionRules: defaultRules,
      alwaysAllowTools: ['Read', 'Glob', 'Grep'],
      alwaysDenyTools: [],

      // Thinking mode
      thinkingMode: 'adaptive',
      thinkingBudget: 32000,
      thinkingAutoTrigger: true,

      // Memory system
      memories: defaultMemories,
      autoExtractMemory: true,
      memoryCategories: ['project', 'preference', 'pattern', 'constraint'],

      // CLAUDE.md
      claudeMd: {
        enabled: true,
        paths: ['CLAUDE.md', '.claude/CLAUDE.md'],
        autoGenerate: false,
        content: '',
      },

      // Plan mode
      planMode: {
        enabled: false,
        pendingChanges: [],
        approvedChanges: [],
      },

      // Context injection
      autoInjectGitContext: true,
      autoInjectProjectContext: true,
      contextCacheEnabled: true,

      // Compaction
      compactionEnabled: true,
      compactionThreshold: 40000,
      compactionLimit: 50000,

      // Output
      outputStyle: 'detailed',
      effort: 'medium',
      codeBlockLanguage: true,
      showLineNumbers: true,

      // Agent
      defaultAgentModel: 'sonnet',
      maxConcurrentAgents: 3,
      agentTimeout: 300,

      // Query Engine
      queryEngine: {
        maxTurns: 100,
        maxBudgetUsd: 10,
        costPer1KTokens: 0.015,
        compactReserveTokens: 20000,
      },

      // AI Council
      aiCouncil: {
        enabled: true,
        maxRounds: 5,
        votingThreshold: 0.6,
        enableConsensus: true,
        enableDebate: true,
        autoTriggerForComplexity: true,
        complexityThreshold: 7,
      },

      // External APIs
      externalAPIs: defaultExternalAPIs,

      // Frustration Detection
      frustrationDetection: {
        enabled: true,
        keywords: ['fuck', 'shit', 'damn', 'wtf', 'stupid', 'not working', 'broken', 'useless'],
        triggerThreshold: 3,
      },

      // Permission actions
      setPermissionMode: (mode) => set({ permissionMode: mode }),
      addPermissionRule: (rule) =>
        set((state) => ({
          permissionRules: [...state.permissionRules, rule],
        })),
      removePermissionRule: (index) =>
        set((state) => ({
          permissionRules: state.permissionRules.filter((_, i) => i !== index),
        })),
      setAlwaysAllowTools: (tools) => set({ alwaysAllowTools: tools }),
      setAlwaysDenyTools: (tools) => set({ alwaysDenyTools: tools }),

      // Thinking actions
      setThinkingMode: (mode) => set({ thinkingMode: mode }),
      setThinkingBudget: (budget) => set({ thinkingBudget: budget }),
      setThinkingAutoTrigger: (enabled) => set({ thinkingAutoTrigger: enabled }),

      // Memory actions
      addMemory: (memory) =>
        set((state) => ({
          memories: [
            ...state.memories,
            {
              ...memory,
              id: Date.now().toString(36) + Math.random().toString(36).substr(2),
              createdAt: Date.now(),
              lastAccessed: Date.now(),
              accessCount: 0,
            },
          ],
        })),
      removeMemory: (id) =>
        set((state) => ({
          memories: state.memories.filter((m) => m.id !== id),
        })),
      setAutoExtractMemory: (enabled) => set({ autoExtractMemory: enabled }),

      // CLAUDE.md actions
      setCLAUDEmd: (config) =>
        set((state) => ({
          claudeMd: { ...state.claudeMd, ...config },
        })),

      // Plan mode actions
      setPlanMode: (state) =>
        set((s) => ({
          planMode: { ...s.planMode, ...state },
        })),
      addPendingChange: (change) =>
        set((s) => ({
          planMode: {
            ...s.planMode,
            pendingChanges: [
              ...s.planMode.pendingChanges,
              { ...change, id: Date.now().toString(36) },
            ],
          },
        })),
      approveChange: (id) =>
        set((s) => ({
          planMode: {
            ...s.planMode,
            approvedChanges: [...s.planMode.approvedChanges, id],
            pendingChanges: s.planMode.pendingChanges.filter((c) => c.id !== id),
          },
        })),
      rejectChange: (id) =>
        set((s) => ({
          planMode: {
            ...s.planMode,
            pendingChanges: s.planMode.pendingChanges.filter((c) => c.id !== id),
          },
        })),
      clearPendingChanges: () =>
        set((s) => ({
          planMode: { ...s.planMode, pendingChanges: [] },
        })),

      // Context actions
      setAutoInjectGitContext: (enabled) => set({ autoInjectGitContext: enabled }),
      setAutoInjectProjectContext: (enabled) => set({ autoInjectProjectContext: enabled }),
      setContextCacheEnabled: (enabled) => set({ contextCacheEnabled: enabled }),

      // Compaction actions
      setCompactionEnabled: (enabled) => set({ compactionEnabled: enabled }),
      setCompactionThreshold: (threshold) => set({ compactionThreshold: threshold }),
      setCompactionLimit: (limit) => set({ compactionLimit: limit }),

      // Output actions
      setOutputStyle: (style) => set({ outputStyle: style }),
      setEffort: (effort) => set({ effort }),
      setCodeBlockLanguage: (enabled) => set({ codeBlockLanguage: enabled }),
      setShowLineNumbers: (enabled) => set({ showLineNumbers: enabled }),

      // Agent actions
      setDefaultAgentModel: (model) => set({ defaultAgentModel: model }),
      setMaxConcurrentAgents: (count) => set({ maxConcurrentAgents: count }),
      setAgentTimeout: (timeout) => set({ agentTimeout: timeout }),

      // Query Engine actions
      setQueryEngineConfig: (config) =>
        set((s) => ({
          queryEngine: { ...s.queryEngine, ...config },
        })),

      // AI Council actions
      setAICouncilConfig: (config) =>
        set((s) => ({
          aiCouncil: { ...s.aiCouncil, ...config },
        })),

      // External APIs actions
      setExternalAPIs: (config) =>
        set((s) => ({
          externalAPIs: { ...s.externalAPIs, ...config },
        })),

      // Frustration Detection actions
      setFrustrationDetection: (config) =>
        set((s) => ({
          frustrationDetection: { ...s.frustrationDetection, ...config },
        })),
    }),
    {
      name: 'opendesktop-appstate-v2',
      version: 2,
      partialize: (state) => ({
        permissionMode: state.permissionMode,
        thinkingMode: state.thinkingMode,
        thinkingBudget: state.thinkingBudget,
        memories: state.memories,
        outputStyle: state.outputStyle,
        effort: state.effort,
        compactionEnabled: state.compactionEnabled,
        queryEngine: state.queryEngine,
        externalAPIs: state.externalAPIs,
        frustrationDetection: state.frustrationDetection,
        claudeMd: state.claudeMd,
      }),
      migrate: (persisted: any, version: number) => {
        if (version === 0) {
          return { ...persisted, claudeMd: { enabled: false, paths: [], autoGenerate: false, content: '' } }
        }
        return persisted as any
      },
    }
  )
)
