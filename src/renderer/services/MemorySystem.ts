import { Memory } from '../types'

export const MEMORY_EXTRACTION_PROMPT = `Review the conversation and extract any important information that should be remembered. Look for:
- Facts about the user (name, location, preferences, skills)
- User preferences (coding style, language preferences, tool preferences)
- Instructions for how the AI should behave
- Project context (tech stack, architecture, conventions)

Return memories in JSON format:
[{"content": "the fact", "category": "fact|preference|instruction|context"}]

Only extract information that is genuinely useful for future conversations. Do not extract trivial or obvious information.`

export function categorizeMemory(text: string): Memory['category'] {
  const lower = text.toLowerCase()

  if (lower.includes('prefer') || lower.includes('like') || lower.includes('want') || lower.includes('hate')) {
    return 'preference'
  }
  if (lower.includes('always') || lower.includes('never') || lower.includes('should') || lower.includes('must')) {
    return 'instruction'
  }
  if (lower.includes('project') || lower.includes('code') || lower.includes('tech') || lower.includes('stack')) {
    return 'context'
  }
  return 'fact'
}

export function buildMemoryPrompt(memories: Memory[]): string {
  if (memories.length === 0) return ''

  const grouped: Record<string, Memory[]> = {}
  for (const m of memories) {
    if (!grouped[m.category]) grouped[m.category] = []
    grouped[m.category].push(m)
  }

  const lines = ['## User Memories (persisted across conversations)']

  for (const [category, mems] of Object.entries(grouped)) {
    lines.push(`\n### ${category.charAt(0).toUpperCase() + category.slice(1)}s:`)
    for (const m of mems) {
      lines.push(`- ${m.content}`)
    }
  }

  lines.push('\nUse these memories to personalize your responses. Reference them when relevant.')

  return lines.join('\n')
}

export function formatMemoryForDisplay(memory: Memory): string {
  const icons: Record<string, string> = {
    fact: '💡',
    preference: '❤️',
    instruction: '📋',
    context: '🏗️',
  }
  return `${icons[memory.category] || '📝'} ${memory.content}`
}
