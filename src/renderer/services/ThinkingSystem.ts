import { ThinkingState } from '../types'

export const THINKING_KEYWORDS = [
  'think', 'think deeply', 'ultrathink', 'reason', 'analyze',
  'break down', 'step by step', 'carefully', 'consider',
]

export function hasThinkingKeyword(text: string): boolean {
  const lower = text.toLowerCase()
  return THINKING_KEYWORDS.some((kw) => lower.includes(kw))
}

export function findThinkingTriggers(text: string): Array<{ word: string; start: number; end: number }> {
  const positions: Array<{ word: string; start: number; end: number }> = []
  const regex = /\b(think|ultrathink|reason|analyze|step by step)\b/gi
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index !== undefined) {
      positions.push({
        word: match[0],
        start: match.index,
        end: match.index + match[0].length,
      })
    }
  }
  return positions
}

export function getDefaultThinkingState(): ThinkingState {
  return {
    enabled: true,
    mode: 'adaptive',
    budgetTokens: 4096,
    isThinking: false,
    thinkingContent: '',
  }
}

export function shouldEnableThinking(thinking: ThinkingState, userMessage: string): boolean {
  if (!thinking.enabled) return false
  if (thinking.mode === 'ultrathink') return true
  if (thinking.mode === 'disabled') return false
  if (thinking.mode === 'adaptive') {
    return hasThinkingKeyword(userMessage) || userMessage.length > 200
  }
  return thinking.enabled
}

export function buildThinkingSystemPrompt(thinking: ThinkingState): string {
  if (!thinking.enabled || thinking.mode === 'disabled') {
    return ''
  }

  let prompt = ''
  if (thinking.mode === 'adaptive') {
    prompt += 'Use adaptive thinking: think deeply when the problem is complex, respond directly for simple questions.\n'
  } else if (thinking.mode === 'ultrathink') {
    prompt += 'ULTRATHINK MODE: Think extremely deeply about every problem. Break down complex reasoning into clear steps. Consider multiple perspectives before answering.\n'
  }

  prompt += `Thinking budget: ${thinking.budgetTokens} tokens.\n`
  prompt += 'Wrap your thinking in <thinking>...</thinking> tags. Keep thinking internal - do not show it in your final response unless asked.\n'

  return prompt
}
