export interface SlashCommand {
  name: string
  description: string
  category: 'session' | 'context' | 'system' | 'agent'
  handler: (args: string) => SlashCommandResult
}

export interface SlashCommandResult {
  type: 'success' | 'error' | 'info' | 'system'
  message: string
  data?: Record<string, any>
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Session commands
  {
    name: 'clear',
    description: 'Clear current conversation history',
    category: 'session',
    handler: () => ({
      type: 'success',
      message: 'Conversation cleared. Starting fresh.',
      data: { action: 'clear' },
    }),
  },
  {
    name: 'compact',
    description: 'Manually compress conversation context',
    category: 'session',
    handler: () => ({
      type: 'info',
      message: 'Context compression triggered. Summarizing earlier messages...',
      data: { action: 'compact' },
    }),
  },
  {
    name: 'resume',
    description: 'Resume from last saved session state',
    category: 'session',
    handler: () => ({
      type: 'info',
      message: 'Looking for saved sessions to resume...',
      data: { action: 'resume' },
    }),
  },
  {
    name: 'export',
    description: 'Export current conversation as markdown',
    category: 'session',
    handler: () => ({
      type: 'success',
      message: 'Conversation exported to clipboard.',
      data: { action: 'export' },
    }),
  },

  // Context commands
  {
    name: 'init',
    description: 'Analyze current project and generate CLAUDE.md',
    category: 'context',
    handler: () => ({
      type: 'info',
      message: 'Analyzing project structure, git status, and conventions...',
      data: { action: 'init' },
    }),
  },
  {
    name: 'context',
    description: 'Show current context injection status',
    category: 'context',
    handler: () => ({
      type: 'info',
      message: 'Current context: Git branch, project files, CLAUDE.md loaded.',
      data: { action: 'context' },
    }),
  },
  {
    name: 'git',
    description: 'Show current git status and recent commits',
    category: 'context',
    handler: () => ({
      type: 'info',
      message: 'Fetching git status...',
      data: { action: 'git' },
    }),
  },

  // System commands
  {
    name: 'settings',
    description: 'Open settings panel',
    category: 'system',
    handler: () => ({
      type: 'success',
      message: 'Opening settings...',
      data: { action: 'settings' },
    }),
  },
  {
    name: 'help',
    description: 'Show available slash commands',
    category: 'system',
    handler: () => ({
      type: 'info',
      message: 'Available commands: /clear, /compact, /resume, /export, /init, /context, /git, /settings, /help, /plan, /skills, /agents, /todos, /memory',
      data: { action: 'help' },
    }),
  },
  {
    name: 'memory',
    description: 'Show or manage stored memories',
    category: 'system',
    handler: (args) => {
      if (args === 'clear') {
        return { type: 'success', message: 'All memories cleared.', data: { action: 'memory-clear' } }
      }
      if (args && !['list', 'clear'].includes(args)) {
        return { type: 'info', message: `Saving memory: ${args}`, data: { action: 'memory-add', value: args } }
      }
      return { type: 'info', message: 'Listing stored memories.', data: { action: 'memory-list' } }
    },
  },

  // Agent commands
  {
    name: 'plan',
    description: 'Enter plan mode for approval before changes',
    category: 'agent',
    handler: () => ({
      type: 'info',
      message: 'Entering plan mode. I will propose changes for your approval before executing.',
      data: { action: 'plan-mode' },
    }),
  },
  {
    name: 'skills',
    description: 'List available skills',
    category: 'agent',
    handler: () => ({
      type: 'info',
      message: 'Loading available skills...',
      data: { action: 'skills-list' },
    }),
  },
  {
    name: 'agents',
    description: 'Show active sub-agents and tasks',
    category: 'agent',
    handler: () => ({
      type: 'info',
      message: 'No active sub-agents.',
      data: { action: 'agents-list' },
    }),
  },
  {
    name: 'todos',
    description: 'Show or manage task list',
    category: 'agent',
    handler: (args) => {
      if (!args || args === 'list') {
        return { type: 'info', message: 'No active tasks.', data: { action: 'todos-list' } }
      }
      return { type: 'success', message: `Task added: ${args}`, data: { action: 'todos-add', task: args } }
    },
  },
]

export function parseSlashCommand(input: string): { command: SlashCommand | null; args: string; isCommand: boolean } {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) {
    return { command: null, args: '', isCommand: false }
  }

  const parts = trimmed.slice(1).split(/\s+/)
  const name = parts[0].toLowerCase()
  const args = parts.slice(1).join(' ')

  const command = SLASH_COMMANDS.find((c) => c.name === name) || null
  return { command, args, isCommand: true }
}

export function getCommandsByCategory(): Record<string, SlashCommand[]> {
  const categories: Record<string, SlashCommand[]> = {}
  for (const cmd of SLASH_COMMANDS) {
    if (!categories[cmd.category]) {
      categories[cmd.category] = []
    }
    categories[cmd.category].push(cmd)
  }
  return categories
}
