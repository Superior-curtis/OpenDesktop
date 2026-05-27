// ============================================================================
// API Retry/Recovery (based on Claude Code's withRetry.ts)
// Exponential backoff + jitter, error-specific handling, streaming retry
// ============================================================================

const DEFAULT_MAX_RETRIES = 10
const BASE_DELAY_MS = 500
const MAX_BACKOFF_MS = 32_000
const MAX_529_RETRIES = 3
const JITTER_FACTOR = 0.25

export class RetryError extends Error {
  constructor(
    public readonly originalError: unknown,
    public readonly attempt: number,
  ) {
    super(originalError instanceof Error ? originalError.message : 'Unknown error')
    this.name = 'RetryError'
    if (originalError instanceof Error && originalError.stack) {
      this.stack = originalError.stack
    }
  }
}

export class FallbackTriggeredError extends Error {
  constructor(
    public readonly originalModel: string,
    public readonly fallbackModel: string,
  ) {
    super(`Model fallback: ${originalModel} -> ${fallbackModel}`)
    this.name = 'FallbackTriggeredError'
  }
}

export interface RetryOptions {
  maxRetries?: number
  model: string
  fallbackModel?: string
  signal?: AbortSignal
}

export interface RetryEvent {
  type: 'retry' | 'fallback' | 'error' | 'recovered'
  attempt: number
  delay: number
  error: string
}

// Error classification helpers

export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      error.message.includes('429') ||
      error.message.includes('529') ||
      msg.includes('rate limit') ||
      msg.includes('too many requests') ||
      msg.includes('overloaded')
    )
  }
  return false
}

export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('401') ||
      error.message.includes('auth') ||
      error.message.includes('unauthorized') ||
      error.message.includes('api key')
    )
  }
  return false
}

export function isConnectionError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message
    return (
      msg.includes('ECONNRESET') ||
      msg.includes('EPIPE') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('network') ||
      msg.includes('connect')
    )
  }
  return false
}

export function isContextOverflowError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('context') ||
      msg.includes('max tokens') ||
      msg.includes('too long') ||
      msg.includes('token limit')
    )
  }
  return false
}

export function getRetryDelay(attempt: number): number {
  const exponential = Math.min(
    BASE_DELAY_MS * Math.pow(2, attempt - 1),
    MAX_BACKOFF_MS,
  )
  const jitter = exponential * JITTER_FACTOR * Math.random()
  return Math.floor(exponential + jitter)
}

export function shouldRetry(
  error: unknown,
  attempt: number,
  maxRetries: number,
  consecutive529Errors: number,
): { willRetry: boolean; reason?: string } {
  if (attempt >= maxRetries) {
    return { willRetry: false, reason: 'max_retries_exceeded' }
  }

  if (isAuthError(error)) {
    return { willRetry: false, reason: 'auth_error' }
  }

  if (isRateLimitError(error) && consecutive529Errors >= MAX_529_RETRIES) {
    return { willRetry: false, reason: 'max_529_retries_exceeded' }
  }

  // Don't retry 4xx client errors (except 429/529 rate limits which are handled above)
  if (error instanceof Error && error.message.match(/\b(400|401|403|404|405|406|407|408|409|410|411|412|413|414|415|416|417|422|423|424|425|426|428|431|451)\b/)) {
    return { willRetry: false, reason: 'client_error' }
  }

  return { willRetry: true }
}

export function shouldFallback(
  error: unknown,
  consecutive529Errors: number,
): boolean {
  return isRateLimitError(error) && consecutive529Errors >= MAX_529_RETRIES
}

export async function* withRetry<T>(
  operation: (
    attempt: number,
  ) => AsyncGenerator<{ type: 'chunk'; content: string } | { type: 'complete'; result: T }>,
  options: RetryOptions,
): AsyncGenerator<{ type: 'chunk' | 'retry_event' | 'complete'; content?: string; result?: T; event?: RetryEvent }> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  let consecutive529Errors = 0
  let fallbackModel: string | undefined = options.fallbackModel

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    try {
      const gen = operation(attempt)
      let result: T | undefined

      for await (const event of gen) {
        if (event.type === 'complete') {
          result = event.result
          yield { type: 'complete', result }
          return
        }
        yield event
      }

      if (result !== undefined) {
        yield { type: 'complete', result }
        return
      }
    } catch (error) {
      const err = error as Error
      const is529 = error instanceof Error && error.message.includes('529')

      if (is529) {
        consecutive529Errors++
      }

      // Attempt model fallback on consecutive 529s
      if (shouldFallback(error, consecutive529Errors) && fallbackModel) {
        yield {
          type: 'retry_event' as const,
          event: {
            type: 'fallback',
            attempt,
            delay: 0,
            error: err.message,
          },
        }
        fallbackModel = undefined
        consecutive529Errors = 0
        continue
      }

      const retryDecision = shouldRetry(error, attempt, maxRetries, consecutive529Errors)
      if (!retryDecision.willRetry) throw error

      const delay = getRetryDelay(attempt)

      yield {
        type: 'retry_event' as const,
        event: {
          type: 'retry',
          attempt,
          delay,
          error: err.message,
        },
      }

      await sleep(delay)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
