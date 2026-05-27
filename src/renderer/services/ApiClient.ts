import { Message, Provider } from '../types'
import { transformMessages, supportsThinking, buildProviderRequest, type TransformContext, type ProviderRequest } from './ProviderTransforms'

export class ApiClient {
  private baseUrl: string
  private apiKey: string
  private model: string
  private providerId: string
  private providerType: string

  constructor(provider: Provider) {
    this.baseUrl = provider.baseUrl
    this.apiKey = provider.apiKey
    this.model = provider.model
    this.providerId = provider.id
    this.providerType = (provider as any).providerType || 'openai-compatible'
  }

  private formatMessages(messages: Message[]): { role: string; content: any }[] {
    const raw = messages.map((msg) => {
      if (msg.isThinking && msg.role === 'assistant') {
        return {
          role: 'assistant',
          content: [{ type: 'thinking', text: msg.content }],
        }
      }
      return { role: msg.role, content: msg.content }
    })

    const providerId = this.providerId as any
    const context = {
      provider: providerId,
      model: this.model,
      variant: supportsThinking(this.model, providerId) ? 'thinking' as const : 'default' as const,
      hasThinking: messages.some(m => m.isThinking),
      hasTools: false,
      hasVision: false,
    }

    return transformMessages(raw, context)
  }

  async chat(
    messages: Message[],
    stream: boolean = true,
    thinkingEnabled: boolean = false,
    thinkingBudget?: number,
  ): Promise<AsyncIterableIterator<string>> {
    const providerId = this.providerId as any
    const context: TransformContext = {
      provider: providerId,
      model: this.model,
      variant: supportsThinking(this.model, providerId) ? 'thinking' as const : 'default' as const,
      hasThinking: thinkingEnabled,
      hasTools: false,
      hasVision: false,
    }

    const formatted = this.formatMessages(messages)
    const baseRequest: ProviderRequest = {
      model: this.model,
      messages: formatted,
      system: '',
      maxTokens: 4096,
      temperature: 0.7,
      stream,
      thinking: thinkingEnabled && thinkingBudget ? { type: 'enabled', budgetTokens: thinkingBudget } : undefined,
    }

    const built = buildProviderRequest(baseRequest, context)

    // Strip provider-specific fields that IPC doesn't need
    const body: Record<string, any> = {
      model: built.model,
      messages: built.messages,
      stream: built.stream ?? stream,
      max_tokens: built.maxTokens ?? 4096,
    }
    // Prepend system prompt as a system-role message for OpenAI-compatible APIs
    // that don't handle it via buildProviderRequest (e.g. nvidia-nim, custom, openrouter)
    if (built.system && !built.messages.some((m: any) => m.role === 'system')) {
      built.messages.unshift({ role: 'system', content: built.system })
    }
    if (built.temperature !== undefined) body.temperature = built.temperature
    if ((built as any).reasoning_effort) body.reasoning_effort = (built as any).reasoning_effort
    if ((built as any).thinkingConfig) body.thinkingConfig = (built as any).thinkingConfig

    // Route through Electron IPC to avoid CORS
    const response = await window.electron.api.chat({
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      body: JSON.stringify(body),
      stream,
      providerType: this.providerType,
    })

    if (!response.success) {
      throw new Error(`API Error: ${response.error}`)
    }

    if (!stream) {
      const content = response.content || ''
      async function* generateOnce() { yield content }
      return generateOnce()
    }

    // Streaming through IPC event
    return this.createStreamIterator(response.streamId)
  }

  private async createStreamIterator(streamId: string): Promise<AsyncIterableIterator<string>> {
    let buffer = ''
    let done = false
    let error: Error | null = null
    let chunkCount = 0

    const onData = (data: any) => {
      if (data.streamId !== streamId) return
      if (data.done) {
        console.log(`[RENDERER] stream ${streamId} done signal received`)
        done = true
        return
      }
      if (data.error) {
        console.log(`[RENDERER] stream ${streamId} error: ${data.error}`)
        error = new Error(data.error)
        done = true
        return
      }
      chunkCount++
      buffer += data.chunk
      if (chunkCount % 50 === 0) {
        console.log(`[RENDERER] stream ${streamId} received ${chunkCount} chunks, buffer=${buffer.length} chars`)
      }
    }

    // Register listener BEFORE starting the stream to avoid missing events
    window.electron.api.onStreamData(onData)
    await window.electron.api.startStream(streamId)

    let yieldedCount = 0
    let totalContentLength = 0
    const iterator: AsyncIterableIterator<string> = {
      async next() {
        while (!done && buffer.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }

        if (error) throw error
        if (done && buffer.length === 0) {
          console.log(`[RENDERER] stream ${streamId} done, yielded ${yieldedCount} chunks, total ${totalContentLength} chars`)
          window.electron.api.offStreamData(onData)
          return { done: true, value: undefined }
        }

        const newlineIndex = buffer.indexOf('\n')
        if (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim()
          buffer = buffer.slice(newlineIndex + 1)

          if (line.startsWith('data: ')) {
            const rawData = line.slice(6)
            if (rawData === '[DONE]') {
              console.log(`[RENDERER] stream ${streamId} [DONE], yielded ${yieldedCount} chunks, total ${totalContentLength} chars`)
              window.electron.api.offStreamData(onData)
              return { done: true, value: undefined }
            }
            try {
              const parsed = JSON.parse(rawData)
              if (totalContentLength === 0) {
                console.log(`[RENDERER] first parsed: choices=${parsed.choices?.length || 0} keys=${Object.keys(parsed).join(',')}`)
              }
              const delta = parsed.choices?.[0]?.delta
              if (!delta && totalContentLength === 0) {
                console.log(`[RENDERER] no delta in first chunk! full=${rawData.slice(0, 120)}`)
              }
              const content = delta?.content || ''
              const thinking = delta?.thinking || ''

              if (thinking) {
                yieldedCount++
                totalContentLength += thinking.length
                return { done: false, value: thinking, isThinking: true }
              }
              if (content) {
                yieldedCount++
                totalContentLength += content.length
                if (yieldedCount <= 3) {
                  console.log(`[RENDERER] yielding content #${yieldedCount}: "${content.slice(0, 60)}" (total=${totalContentLength})`)
                }
                return { done: false, value: content }
              }
              if (totalContentLength === 0 && content.length === 0) {
                console.log(`[RENDERER] empty content chunk! delta keys=${Object.keys(delta || {}).join(',')}`)
              }
            } catch (e) {
              if (totalContentLength === 0) console.log(`[RENDERER] JSON parse error on first chunk: "${rawData.slice(0, 80)}"`)
            }
          } else if (totalContentLength === 0) {
            console.log(`[RENDERER] line doesn't start with 'data: ': "${line.slice(0, 60)}"`)
          }
        }

        if (done) {
          console.log(`[RENDERER] stream ${streamId} done (no more lines), yielded ${yieldedCount} chunks, total ${totalContentLength} chars`)
          window.electron.api.offStreamData(onData)
          return { done: true, value: undefined }
        }

        return { done: false, value: '' }
      },
      [Symbol.asyncIterator]() {
        return this
      },
    }

    return iterator
  }

  async testConnection(): Promise<{ success: boolean; error?: string; models?: string[] }> {
    const result = await window.electron.api.testProvider({
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      model: this.model,
    })
    return result
  }
}

export function createApiClient(provider: Provider): ApiClient {
  return new ApiClient(provider)
}
