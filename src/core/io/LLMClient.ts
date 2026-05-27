export interface LLMProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | any[]
  id?: string
  timestamp?: number
}

export interface LLMClient {
  chat(messages: ChatMessage[], options?: { stream?: boolean; thinking?: boolean; budgetTokens?: number }): Promise<AsyncIterableIterator<string>>
  testConnection(provider: LLMProvider): Promise<boolean>
}
