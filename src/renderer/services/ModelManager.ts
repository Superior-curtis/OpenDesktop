// ============================================================================
// Model Management (based on Claude Code's utils/model/)
// Model configs, aliases, capabilities, provider definitions, context windows
// ============================================================================

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'openrouter' | 'opencode' | 'custom'

export type ModelCapability = 'thinking' | 'tools' | 'streaming' | 'vision' | 'function_calling' | 'json_mode' | 'cache'

export interface ModelConfig {
  id: string
  name: string
  provider: ModelProvider
  aliases: string[]
  contextWindow: number
  maxOutputTokens: number
  capabilities: ModelCapability[]
  pricing: {
    input: number    // per 1M tokens
    output: number   // per 1M tokens
    cacheRead?: number
    cacheCreate?: number
  }
  supportsThinking?: boolean
  maxThinkingTokens?: number
  isDeprecated?: boolean
  deprecationDate?: string
}

export interface ProviderConfig {
  id: ModelProvider
  name: string
  baseUrl: string
  apiKeyEnvVar: string
  defaultModel: string
  models: string[]
  supportsCustomModels: boolean
}

// ============================================================================
// Model Registry
// ============================================================================

const MODELS: ModelConfig[] = [
  // Anthropic
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    aliases: ['sonnet-4', 'claude-sonnet-4', 'claude-4-sonnet'],
    contextWindow: 200000,
    maxOutputTokens: 8192,
    capabilities: ['thinking', 'tools', 'streaming', 'vision', 'cache'],
    pricing: { input: 3, output: 15, cacheRead: 0.30, cacheCreate: 3.75 },
    supportsThinking: true,
    maxThinkingTokens: 16000,
  },
  {
    id: 'claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    aliases: ['sonnet-3.5', 'claude-sonnet-3.5'],
    contextWindow: 200000,
    maxOutputTokens: 8192,
    capabilities: ['thinking', 'tools', 'streaming', 'vision', 'cache'],
    pricing: { input: 3, output: 15, cacheRead: 0.30, cacheCreate: 3.75 },
    supportsThinking: true,
    maxThinkingTokens: 8192,
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    aliases: ['opus', 'claude-opus'],
    contextWindow: 200000,
    maxOutputTokens: 4096,
    capabilities: ['thinking', 'tools', 'streaming', 'vision', 'cache'],
    pricing: { input: 15, output: 75, cacheRead: 1.50, cacheCreate: 18.75 },
    supportsThinking: true,
    maxThinkingTokens: 4096,
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    aliases: ['haiku', 'claude-haiku'],
    contextWindow: 200000,
    maxOutputTokens: 4096,
    capabilities: ['tools', 'streaming', 'vision', 'cache'],
    pricing: { input: 0.25, output: 1.25, cacheRead: 0.03, cacheCreate: 0.30 },
  },
  // OpenCode Zen
  {
    id: 'qwen3.6-plus',
    name: 'Qwen 3.6 Plus',
    provider: 'opencode',
    aliases: ['qwen-plus', 'zen'],
    contextWindow: 131072,
    maxOutputTokens: 8192,
    capabilities: ['thinking', 'tools', 'streaming'],
    pricing: { input: 0.50, output: 2.0, cacheRead: 0.05, cacheCreate: 0.50 },
    supportsThinking: true,
    maxThinkingTokens: 8192,
  },
  {
    id: 'qwen3.6-max',
    name: 'Qwen 3.6 Max',
    provider: 'opencode',
    aliases: ['qwen-max'],
    contextWindow: 131072,
    maxOutputTokens: 8192,
    capabilities: ['thinking', 'tools', 'streaming'],
    pricing: { input: 1.0, output: 4.0, cacheRead: 0.10, cacheCreate: 1.0 },
    supportsThinking: true,
    maxThinkingTokens: 16000,
  },
  // OpenAI
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    aliases: ['gpt4o', 'gpt-4o'],
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: ['tools', 'streaming', 'vision', 'function_calling', 'json_mode'],
    pricing: { input: 2.50, output: 10.0 },
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    aliases: ['gpt4o-mini', 'gpt-4o-mini'],
    contextWindow: 128000,
    maxOutputTokens: 16384,
    capabilities: ['tools', 'streaming', 'vision', 'function_calling', 'json_mode'],
    pricing: { input: 0.15, output: 0.60 },
  },
  // OpenRouter
  {
    id: 'openrouter/auto',
    name: 'OpenRouter Auto',
    provider: 'openrouter',
    aliases: ['or-auto'],
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: ['tools', 'streaming'],
    pricing: { input: 0, output: 0 },
  },
]

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-3.5-sonnet', 'claude-3-opus', 'claude-3-haiku'],
    supportsCustomModels: true,
  },
  {
    id: 'opencode',
    name: 'OpenCode Zen',
    baseUrl: 'https://opencode.ai/zen/v1',
    apiKeyEnvVar: 'OPENCODE_API_KEY',
    defaultModel: 'qwen3.6-plus',
    models: ['qwen3.6-plus', 'qwen3.6-max'],
    supportsCustomModels: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini'],
    supportsCustomModels: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    defaultModel: 'openrouter/auto',
    models: ['openrouter/auto'],
    supportsCustomModels: true,
  },
  {
    id: 'google',
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyEnvVar: 'GOOGLE_API_KEY',
    defaultModel: 'gemini-2.0-flash',
    models: [],
    supportsCustomModels: true,
  },
  {
    id: 'custom',
    name: 'Custom',
    baseUrl: '',
    apiKeyEnvVar: '',
    defaultModel: '',
    models: [],
    supportsCustomModels: true,
  },
]

// ============================================================================
// Model Manager
// ============================================================================

export class ModelManager {
  private models: Map<string, ModelConfig> = new Map()

  constructor() {
    for (const m of MODELS) {
      this.models.set(m.id, m)
      for (const alias of m.aliases) {
        if (!this.models.has(alias)) {
          this.models.set(alias, m)
        }
      }
    }
  }

  getModel(id: string): ModelConfig | undefined {
    return this.models.get(id)
  }

  resolveAlias(id: string): ModelConfig | undefined {
    const model = this.models.get(id)
    if (model) return model

    // Try partial matching
    const lower = id.toLowerCase()
    for (const [key, m] of this.models) {
      if (key.toLowerCase().includes(lower) || m.name.toLowerCase().includes(lower)) {
        return m
      }
    }
    return undefined
  }

  getModelsByProvider(provider: ModelProvider): ModelConfig[] {
    return MODELS.filter((m) => m.provider === provider)
  }

  getProvider(id: ModelProvider): ProviderConfig | undefined {
    return PROVIDERS.find((p) => p.id === id)
  }

  getProviders(): ProviderConfig[] {
    return [...PROVIDERS]
  }

  hasCapability(modelId: string, capability: ModelCapability): boolean {
    const model = this.resolveAlias(modelId)
    return model?.capabilities.includes(capability) ?? false
  }

  supportsThinking(modelId: string): boolean {
    const model = this.resolveAlias(modelId)
    return model?.supportsThinking ?? false
  }

  getContextWindow(modelId: string): number {
    return this.resolveAlias(modelId)?.contextWindow ?? 4096
  }

  getMaxOutputTokens(modelId: string): number {
    return this.resolveAlias(modelId)?.maxOutputTokens ?? 4096
  }

  getPricing(modelId: string): { input: number; output: number; cacheRead?: number } {
    const model = this.resolveAlias(modelId)
    if (!model) return { input: 3, output: 15 }
    return { ...model.pricing }
  }

  getModelsForPrompt(): string {
    return MODELS
      .filter((m) => !m.isDeprecated)
      .map((m) => `- ${m.name} (\`${m.id}\`): ${m.contextWindow.toLocaleString()} ctx, ${m.capabilities.join(', ')}`)
      .join('\n')
  }

  getContextWindowUpgrade(modelId: string): { original: number; upgraded: number } | null {
    // Some models get context window upgrades based on usage tier
    if (modelId.includes('sonnet-4')) {
      return { original: 200000, upgraded: 200000 }
    }
    return null
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalModelManager: ModelManager | null = null

export function getModelManager(): ModelManager {
  if (!globalModelManager) globalModelManager = new ModelManager()
  return globalModelManager
}
