import { z } from 'zod'
import { getDynamicSkills, getSkill, addInvokedSkill, getSkillContent } from './Skills'
import { FileEditTool } from './FileEditTool'
import { runAgent, getAgentDefinition } from './AgentSystem'
import { useChatStore } from '../store/chatStore'

// ============================================================================
// Tool Result Types
// ============================================================================

export interface ToolResult<Output = unknown> {
  content: string
  isError: boolean
  output?: Output
  metadata?: Record<string, any>
}

// ============================================================================
// Permission Types
// ============================================================================

export type PermissionBehavior = 'allow' | 'deny' | 'ask' | 'passthrough'

export interface PermissionResult {
  behavior: PermissionBehavior
  message?: string
  updatedInput?: Record<string, unknown>
  decisionReason?: {
    type: 'rule' | 'hook' | 'safetyCheck' | 'mode' | 'classifier' | 'asyncAgent' | 'other'
    rule?: any
    hookName?: string
    reason?: string
    mode?: string
    classifier?: string
    classifierApprovable?: boolean
  }
}

// ============================================================================
// Tool Context
// ============================================================================

export interface ToolContext {
  cwd: string
  signal: AbortSignal
  getAppState: () => any
  setAppState: (fn: (prev: any) => any) => void
  messages: any[]
  agentId?: string
}

// ============================================================================
// Tool Progress Types
// ============================================================================

export interface ToolProgress {
  type: string
  message: string
  percentage?: number
  metadata?: Record<string, any>
}

// ============================================================================
// Tool Interface (based on Claude Code's 792-line Tool type)
// ============================================================================

export interface Tool<Input = any, Output = unknown> {
  name: string
  aliases?: string[]
  description: string
  searchHint?: string
  inputSchema: z.ZodType<Input>
  outputSchema?: z.ZodType<Output>
  call(
    args: Input,
    context: ToolContext,
    onProgress?: (progress: ToolProgress) => void,
  ): Promise<ToolResult<Output>>
  checkPermissions(
    input: Input,
    context: ToolContext,
  ): Promise<PermissionResult>
  isConcurrencySafe(input: Input): boolean
  isEnabled(): boolean
  isReadOnly(input: Input): boolean
  isDestructive?(input: Input): boolean
  requiresUserInteraction?(): boolean
  prompt(options: {
    tools: Tool[]
    agents: any[]
    allowedAgentTypes?: string[]
  }): Promise<string>
  toAutoClassifierInput(input: Input): unknown
  mapToolResultToToolResultBlockParam(
    content: string,
    toolUseID: string,
  ): { type: string; content: string; tool_use_id: string; is_error: boolean }
  maxResultSizeChars: number
  alwaysLoad?: boolean
  shouldDefer?: boolean
  mcpInfo?: { serverName: string; toolName: string }
}

import { buildTool } from './ToolBuilder'

// ============================================================================
// Tool Registry
// ============================================================================

export type Tools = Tool<any, any>[]

export function findToolByName(tools: Tools, name: string): Tool | undefined {
  for (const tool of tools) {
    if (tool.name === name) return tool
    if (tool.aliases?.includes(name)) return tool
  }
  return undefined
}

export function assembleToolPool(
  builtInTools: Tools,
  mcpTools: Tools = [],
): Tools {
  const allTools = [...builtInTools, ...mcpTools]
  const seen = new Set<string>()
  return allTools.filter((tool) => {
    if (seen.has(tool.name)) return false
    seen.add(tool.name)
    return tool.isEnabled()
  })
}

// ============================================================================
// Built-in Tool Implementations
// ============================================================================

export const ReadTool = buildTool({
  name: 'Read',
  description: 'Read file contents',
  inputSchema: z.object({
    file_path: z.string(),
    offset: z.number().optional(),
    limit: z.number().optional(),
  }),
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  call: async (args, _context) => {
    try {
      const content = await window.api.readFile(args.file_path)
      return { content, isError: false }
    } catch (error) {
      return {
        content: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true,
      }
    }
  },
  toAutoClassifierInput: (input) => input.file_path,
})

export const WriteTool = buildTool({
  name: 'Write',
  description: 'Write content to a file',
  inputSchema: z.object({
    file_path: z.string(),
    content: z.string(),
  }),
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => true,
  call: async (args, _context) => {
    try {
      await window.api.writeFile(args.file_path, args.content)
      return { content: `Successfully wrote to ${args.file_path}`, isError: false }
    } catch (error) {
      return {
        content: `Error writing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true,
      }
    }
  },
  toAutoClassifierInput: (input) => input.file_path,
})

export const BashTool = buildTool({
  name: 'Bash',
  description: 'Execute bash commands',
  inputSchema: z.object({
    command: z.string(),
    description: z.string().optional(),
    run_in_background: z.boolean().optional(),
  }),
  isReadOnly: (input) => {
    const readOnlyCommands = ['ls', 'cat', 'head', 'tail', 'grep', 'find', 'echo', 'pwd', 'whoami', 'date']
    const cmd = input.command.split(' ')[0]
    return readOnlyCommands.includes(cmd)
  },
  isConcurrencySafe: (input) => {
    const safeCommands = ['ls', 'cat', 'head', 'tail', 'grep', 'find', 'echo', 'pwd']
    const cmd = input.command.split(' ')[0]
    return safeCommands.includes(cmd)
  },
  isDestructive: (input) => {
    const destructiveCommands = ['rm', 'mv', 'cp', 'mkdir', 'touch', 'chmod', 'chown']
    const cmd = input.command.split(' ')[0]
    return destructiveCommands.includes(cmd)
  },
  call: async (args, context) => {
    try {
      const result = await window.api.executeCommand(args.command, {
        cwd: context.cwd,
        timeout: 120000,
      })
      return { content: result.stdout || result.stderr, isError: result.exitCode !== 0 }
    } catch (error) {
      return {
        content: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true,
      }
    }
  },
  toAutoClassifierInput: (input) => input.command,
})

export const GlobTool = buildTool({
  name: 'Glob',
  description: 'Find files matching a glob pattern',
  inputSchema: z.object({
    pattern: z.string(),
    path: z.string().optional(),
  }),
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  call: async (args, context) => {
    try {
      const files = await window.api.glob(args.pattern, { cwd: context.cwd })
      return { content: files.join('\n'), isError: false }
    } catch (error) {
      return {
        content: `Error executing glob: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true,
      }
    }
  },
  toAutoClassifierInput: (input) => input.pattern,
})

export const GrepTool = buildTool({
  name: 'Grep',
  description: 'Search for patterns in files',
  inputSchema: z.object({
    pattern: z.string(),
    path: z.string().optional(),
    glob: z.string().optional(),
    output_mode: z.enum(['content', 'files_with_matches', 'count']).optional(),
  }),
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  call: async (args, context) => {
    try {
      const results = await window.api.grep(args.pattern, {
        cwd: context.cwd,
        path: args.path,
        glob: args.glob,
        output_mode: args.output_mode || 'content',
      })
      const content = Array.isArray(results) ? results.join('\n') : String(results)
      return { content, isError: false }
    } catch (error) {
      return {
        content: `Error executing grep: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true,
      }
    }
  },
  toAutoClassifierInput: (input) => input.pattern,
})

export const TodoWriteTool = buildTool({
  name: 'TodoWrite',
  description: 'Create and update tasks for the session',
  inputSchema: z.object({
    action: z.enum(['create', 'update', 'complete', 'delete']),
    todos: z.array(z.object({
      content: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
      priority: z.enum(['high', 'medium', 'low']).optional(),
    })),
  }),
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  call: async (args, _context) => {
    const results = args.todos.map(t => `${args.action}: ${t.content}`)
    return { content: results.join('\n'), isError: false }
  },
  toAutoClassifierInput: (input) => input.todos?.map((t: any) => t.content).join(' ') ?? '',
})

export const AskUserQuestionTool = buildTool({
  name: 'AskUserQuestion',
  description: 'Ask the user a question to get clarification or input',
  inputSchema: z.object({
    question: z.string(),
    options: z.array(z.string()).optional(),
  }),
  isReadOnly: () => true,
  isConcurrencySafe: () => false,
  requiresUserInteraction: () => true,
  call: async (args, _context) => {
    return {
      content: `Question: ${args.question}${args.options ? `\nOptions: ${args.options.join(', ')}` : ''}`,
      isError: false,
      metadata: { type: 'user_question', question: args.question },
    }
  },
  toAutoClassifierInput: (input) => input.question,
})

export const TaskTool = buildTool({
  name: 'task',
  aliases: ['Task', 'delegate', 'fork'],
  description: 'Delegate a complex task to a sub-agent. Use for research, exploration, or multi-step work that benefits from focused execution.',
  inputSchema: z.object({
    description: z.string().describe('Clear description of what the sub-agent should accomplish'),
    prompt: z.string().describe('Detailed instructions for the sub-agent'),
    subagent_type: z.enum(['explore', 'general', 'custom']).optional().describe('Type of agent: explore (read-only research), general (read+write tasks)'),
  }),
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  call: async (args, _context) => {
    try {
      const agentType = args.subagent_type || 'general'
      const agentDef = getAgentDefinition(agentType)
      if (!agentDef) {
        return { content: `No agent definition found for type "${agentType}"`, isError: true }
      }

      const store = useChatStore.getState()
      const provider = store.providers.find(p => p.id === store.activeProviderId)
      if (!provider) {
        return { content: 'No active provider available', isError: true }
      }

      const gen = runAgent({
        agentDefinition: agentDef,
        promptMessages: [
          { role: 'user', content: `Description: ${args.description}\n\nTask: ${args.prompt}` },
        ],
        availableTools: [...DEFAULT_TOOLS],
        signal: _context.signal,
        toolUseContext: {
          cwd: _context.cwd,
          getAppState: _context.getAppState,
          setAppState: _context.setAppState,
          messages: _context.messages,
          options: { tools: DEFAULT_TOOLS, model: provider.model },
        },
        canUseTool: async () => ({ allowed: true }),
      })

      let resultText = ''
      let toolCallCount = 0

      for await (const event of gen) {
        if (event.type === 'text') {
          resultText += event.content
        } else if (event.type === 'tool_call') {
          toolCallCount++
        } else if (event.type === 'agent_error') {
          return {
            content: `Sub-agent error: ${(event as any).error}`,
            isError: true,
          }
        }
      }

      return {
        content: `<task_result agent="${agentType}" tool_calls="${toolCallCount}">\n${resultText}\n</task_result>`,
        isError: false,
        metadata: {
          type: 'task_result',
          agent_type: agentType,
          tool_calls: toolCallCount,
          result_length: resultText.length,
        },
      }
    } catch (error: any) {
      return {
        content: `task tool error: ${error.message || error}`,
        isError: true,
      }
    }
  },
  toAutoClassifierInput: (input) => input.prompt,
})

export const SkillTool = buildTool({
  name: 'Skill',
  description: 'Execute a skill. Skills provide specialized capabilities and domain knowledge. When users ask you to perform tasks, check if any available skills match. When a skill matches the user request, invoke this tool BEFORE generating any other response.',
  inputSchema: z.object({
    name: z.string().describe('The skill name. E.g., "commit", "review-pr", or "pdf"'),
    args: z.array(z.string()).optional().describe('Optional arguments for the skill'),
  }),
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  call: async (args, _context) => {
    const skill = getSkill(args.name) ?? getDynamicSkills().find(s => s.name === args.name)

    if (!skill) {
      const available = getDynamicSkills().map(s => s.name).join(', ')
      return {
        content: `Skill not found: "${args.name}". Available skills: ${available || 'none'}`,
        isError: true,
      }
    }

    if (_context.agentId) {
      addInvokedSkill(_context.agentId, args.name)
    }

    const skillContent = getSkillContent(skill)
    const argString = args.args?.length ? `\nArguments: ${args.args.join(' ')}` : ''

    if (skill.context === 'fork') {
      return {
        content: skillContent + argString + '\n\n[Forked execution requested - use the "task" tool to run this skill in a sub-agent]',
        isError: false,
        metadata: {
          type: 'skill_execution',
          skill_name: args.name,
          context: 'fork',
          skillRoot: skill.skillRoot,
          agent: skill.agent,
        },
      }
    }

    return {
      content: skillContent + argString,
      isError: false,
      metadata: {
        type: 'skill_execution',
        skill_name: args.name,
        context: 'inline',
        skillRoot: skill.skillRoot,
      },
    }
  },
  toAutoClassifierInput: (input) => input.name,
})

export const WebFetchTool = buildTool({
  name: 'WebFetch',
  description: 'Fetch content from a URL',
  inputSchema: z.object({
    url: z.string(),
    max_length: z.number().optional(),
  }),
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  call: async (args, _context) => {
    try {
      const response = await fetch(args.url)
      const content = await response.text()
      const truncated = args.max_length ? content.slice(0, args.max_length) : content
      return { content: truncated, isError: false }
    } catch (error) {
      return {
        content: `Error fetching URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true,
      }
    }
  },
  toAutoClassifierInput: (input) => input.url,
})

export const WebSearchTool = buildTool({
  name: 'WebSearch',
  description: 'Search the web for information',
  inputSchema: z.object({
    query: z.string(),
    num_results: z.number().optional(),
  }),
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  call: async (args, _context) => {
    try {
      const response = await window.api.webSearch(args.query, args.num_results || 5)
      if (!response.success || !response.results) {
        return { content: `Search failed: ${response.error || 'No results'}`, isError: true }
      }
      const formatted = response.results.map((r: any, i: number) =>
        `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.description}`
      ).join('\n\n')
      return { content: formatted, isError: false }
    } catch (error) {
      return {
        content: `Error searching web: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true,
      }
    }
  },
  toAutoClassifierInput: (input) => input.query,
})

// ============================================================================
// Default Tool Pool
// ============================================================================

export const DEFAULT_TOOLS: Tools = [
  ReadTool,
  WriteTool,
  FileEditTool,
  BashTool,
  GlobTool,
  GrepTool,
  TodoWriteTool,
  AskUserQuestionTool,
  TaskTool,
  SkillTool,
  WebFetchTool,
  WebSearchTool,
]
