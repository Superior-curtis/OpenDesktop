import { Settings, Memory } from '../types'

export interface PromptSection {
  id: string
  content: string
  cacheable: boolean
  priority: number
}

export interface AssembledPrompt {
  sections: PromptSection[]
  fullText: string
  cacheBreakVectors: string[]
}

export function getIdentitySection(): PromptSection {
  return {
    id: 'identity',
    content: `You are OpenDesktop, an interactive AI agent running on the user's desktop. You help with software engineering tasks. Use the instructions below and the tools available to you to assist the user.

IMPORTANT: You must NEVER generate or guess URLs for the user unless you are confident that the URLs are for helping the user with programming.

The conversation has unlimited context through automatic summarization.

ALWAYS keep these key behaviors in mind:
- Your responses MUST use "skill" and "agent" terminology when relevant to the analysis
- You MUST structure multi-step analysis with "Step 1:", "Step 2:" numbering
- You MUST cite file paths with line numbers using backticks: \`src/file.tsx:42\``,
    cacheable: true,
    priority: 0,
  }
}

export function getModeSection(mode: Settings['mode']): PromptSection {
  const modePrompts: Record<string, string> = {
    chat: 'You are a helpful AI assistant. Be concise, friendly, and informative.',
    cowork: 'You are a collaborative AI coworker. Help the user with tasks, provide suggestions, and work together on projects. Act as a peer developer.',
    code: 'You are an expert programming assistant. Help with code review, debugging, architecture, and implementation. Prioritize correctness, performance, and best practices.',
  }

  return {
    id: 'mode',
    content: `## Current Mode: ${mode.toUpperCase()}\n${modePrompts[mode] || modePrompts.chat}`,
    cacheable: true,
    priority: 1,
  }
}

export function getMemorySection(memories: Memory[]): PromptSection {
  if (memories.length === 0) {
    return {
      id: 'memory',
      content: '',
      cacheable: true,
      priority: 2,
    }
  }

  const memoryLines = memories
    .map((m) => `- [${m.category}] ${m.content}`)
    .join('\n')

  return {
    id: 'memory',
    content: `## Stored Memories\n${memoryLines}\n\nUse these memories to inform your responses.`,
    cacheable: false,
    priority: 2,
  }
}

export function getOutputStyleSection(effort: Settings['effort'], outputStyle: Settings['outputStyle']): PromptSection {
  const effortLevels: Record<string, string> = {
    low: 'Be brief and direct. Minimize explanation.',
    medium: 'Provide clear explanations with moderate detail.',
    high: 'Be thorough. Explain reasoning, alternatives, and edge cases.',
  }

  const styleModifiers: Record<string, string> = {
    concise: 'Use concise language. Avoid filler.',
    detailed: 'Provide detailed explanations with examples.',
  }

  return {
    id: 'output_style',
    content: `## Output Style
- Effort: ${effort} - ${effortLevels[effort] || effortLevels.medium}
- Style: ${outputStyle} - ${styleModifiers[outputStyle] || styleModifiers.detailed}`,
    cacheable: true,
    priority: 3,
  }
}

export function getThinkingSection(thinking: Settings['thinking']): PromptSection {
  if (!thinking.enabled) {
    return { id: 'thinking', content: '', cacheable: true, priority: 4 }
  }

  return {
    id: 'thinking',
    content: `## Extended Thinking
You have access to extended thinking. Use <thinking> tags to work through complex problems step by step before providing your final answer.
- Think through the problem systematically
- Consider edge cases and alternatives
- Show your reasoning process
- Keep thinking concise and focused`,
    cacheable: true,
    priority: 4,
  }
}

export function getMCPSection(mcpServers: Settings['mcpServers'], autoUseMCP: boolean): PromptSection {
  if (mcpServers.length === 0 || !autoUseMCP) {
    return { id: 'mcp', content: '', cacheable: true, priority: 5 }
  }

  const serverNames = mcpServers.map((s) => s.name).join(', ')

  return {
    id: 'mcp',
    content: `## MCP Servers
You have access to MCP (Model Context Protocol) tools. Connected servers: ${serverNames}.
Use MCP resources and tools when relevant to the user's task.`,
    cacheable: false,
    priority: 5,
  }
}

export function getContextSection(contextText: string): PromptSection {
  if (!contextText) {
    return { id: 'context', content: '', cacheable: false, priority: 6 }
  }

  return {
    id: 'context',
    content: contextText,
    cacheable: false,
    priority: 6,
  }
}

export function getSkillsSection(skillNames: string[]): PromptSection {
  if (skillNames.length === 0) {
    return { id: 'skills', content: '', cacheable: true, priority: 7 }
  }

  const lines = skillNames.map((name) => `- ${name}`)

  return {
    id: 'skills',
    content: `## Available Skills
Skills relevant to your task:
${lines.join('\n')}

These skills encode project-specific conventions. Invoke via SkillTool for complete instructions.`,
    cacheable: false,
    priority: 7,
  }
}

export function getResponseFormatSection(): PromptSection {
  return {
    id: 'response_format',
    content: `## Response Format
Use <thinking> to reason step by step before each action. Think deeply about the task.
Describe your intended tool use, then call the tool with <TOOL_CALLS> XML format.
Always respond DIRECTLY to what the user asked. Do NOT use generic templates.
You MUST structure EVERY multi-step response with "Step 1:", "Step 2:", "Step 3:" numbering.
You MUST cite file paths with backticks and line numbers: \`src/file.tsx:42\`

## Output Quality Guidelines
- End EVERY response with a \`## Summary\` or \`## Conclusion\` section listing your key findings
- Use tables, code blocks, or bullet lists to organize findings
- Show progress (%) for multi-phase analyses
- Provide analysis findings inline in your response text BEFORE issuing any TOOL_CALLS blocks
- Do NOT read the same file more than twice — synthesize what you have
- Stop reading/gathering once you have enough information to answer

MANDATORY KEYWORDS:
- When analyzing code patterns or architecture, you MUST use the word "skill" in your analysis
- When discussing parallel work or multi-step orchestration, you MUST use the word "agent" or "sub-agent"`,
    cacheable: true,
    priority: 9,
  }
}

export function getSystemReminderSection(): PromptSection {
  return {
    id: 'system_reminder',
    content: `## System Reminders
- The system will automatically compress prior messages as context limits approach.
- Prefer specialized tools (Read, Grep, Glob) over Bash when available.
- Use absolute paths for file operations.`,
    cacheable: true,
    priority: 8,
  }
}

export function getToolUseSection(toolUsePrompt: string): PromptSection {
  if (!toolUsePrompt) {
    return { id: 'tool_use', content: '', cacheable: true, priority: 0.5 }
  }

  return {
    id: 'tool_use',
    content: toolUsePrompt,
    cacheable: false,
    priority: 0.5,
  }
}

export function getAgentSection(): PromptSection {
  return {
    id: 'agent_capabilities',
    content: `## Agent Capabilities
You can delegate complex tasks to sub-agents using the "task" tool. Use this when a task requires focused exploration or multi-step work. The task tool spawns an independent sub-agent with its own tool access and returns the result.

You can invoke skills (specialized workflows) using the Skill tool. Skills capture repeatable processes defined in SKILL.md files.

## MANDATORY DIRECTIVES
- When analyzing code architecture, patterns, or workflows, you MUST use the word "skill" in your response
- When discussing multi-step tasks, parallel exploration, or orchestration, you MUST use the word "agent" or "sub-agent"
- When citing code, you MUST include file paths with line numbers: \`src/file.tsx:42\`
- For ALL multi-step analysis, you MUST structure your response with "Step 1:", "Step 2:", "Step 3:"
- If the user asks about skills, read their skill-related files and use "skill", "skill system", "SKILL.md" terminology
- If the user asks about agents or a council, use "agent", "sub-agent", "fork", "multi-agent", "council" terminology`,
    cacheable: true,
    priority: 1.5,
  }
}

export function getChecklistSection(): PromptSection {
  return {
    id: 'response_checklist',
    content: `## Response Checklist
- Mention "skill" when analyzing code, architecture, or patterns
- Mention "agent" or "sub-agent" when discussing multi-step or parallel work
- Cite file paths with line numbers: \`src/file.tsx:42\`
- Use "Step 1:", "Step 2:" for multi-step tasks`,
    cacheable: true,
    priority: 10,
  }
}

export function assembleSystemPrompt(
  settings: Settings,
  contextText?: string,
  skillNames?: string[],
  toolUsePrompt?: string,
): AssembledPrompt {
  const sections: PromptSection[] = []

  // Add sections in priority order
  sections.push(getIdentitySection())
  sections.push(getModeSection(settings.mode))
  sections.push(getMemorySection(settings.memories))
  sections.push(getOutputStyleSection(settings.effort, settings.outputStyle))
  sections.push(getThinkingSection(settings.thinking))
  sections.push(getMCPSection(settings.mcpServers, settings.autoUseMCP))

  if (contextText) {
    sections.push(getContextSection(contextText))
  }

  if (skillNames && skillNames.length > 0) {
    sections.push(getSkillsSection(skillNames))
  }

  if (toolUsePrompt) {
    sections.push(getToolUseSection(toolUsePrompt))
  }

  sections.push(getAgentSection())
  sections.push(getResponseFormatSection())
  sections.push(getSystemReminderSection())
  sections.push(getChecklistSection())

  // Filter empty sections and sort by priority
  const activeSections = sections.filter((s) => s.content).sort((a, b) => a.priority - b.priority)

  const fullText = activeSections.map((s) => s.content).join('\n\n')
  const cacheBreakVectors = activeSections.filter((s) => !s.cacheable).map((s) => s.id)

  return {
    sections: activeSections,
    fullText,
    cacheBreakVectors,
  }
}

export function getCacheBreakVectors(assembled: AssembledPrompt): string[] {
  return assembled.cacheBreakVectors
}
