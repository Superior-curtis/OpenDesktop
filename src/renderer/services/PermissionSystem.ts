import { classifyCommand, detectInjections, parseShellCommand } from './BashParser'
import { enrichCommandClassification, defaultArityResolver } from './BashArity'

// ============================================================================
// Permission Types (based on Claude Code source: src/types/permissions.ts)
// ============================================================================

export type PermissionBehavior = 'allow' | 'deny' | 'ask'

export type PermissionMode =
  | 'default'
  | 'plan'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'dontAsk'
  | 'auto'

export type PermissionRuleSource =
  | 'localSettings'
  | 'userSettings'
  | 'projectSettings'
  | 'policySettings'
  | 'bundle'
  | 'plugin'
  | 'cliArg'
  | 'command'
  | 'session'

export interface PermissionRuleValue {
  toolName: string
  ruleContent?: string
}

export interface PermissionRule {
  source: PermissionRuleSource
  ruleBehavior: PermissionBehavior
  ruleValue: PermissionRuleValue
}

export type PermissionDecisionReasonType =
  | 'rule'
  | 'hook'
  | 'safetyCheck'
  | 'mode'
  | 'classifier'
  | 'asyncAgent'
  | 'other'

export interface PermissionDecisionReason {
  type: PermissionDecisionReasonType
  rule?: PermissionRule
  hookName?: string
  reason?: string
  mode?: PermissionMode
  classifier?: string
  classifierApprovable?: boolean
}

export interface PermissionAllowDecision {
  behavior: 'allow'
  decisionReason?: PermissionDecisionReason
  message?: string
  updatedInput?: Record<string, any>
}

export interface PermissionDenyDecision {
  behavior: 'deny'
  decisionReason?: PermissionDecisionReason
  message?: string
}

export interface PermissionAskDecision {
  behavior: 'ask'
  decisionReason?: PermissionDecisionReason
  message?: string
  updatedInput?: Record<string, any>
}

export type PermissionDecision = PermissionAllowDecision | PermissionDenyDecision | PermissionAskDecision

export interface PermissionResult {
  behavior: PermissionBehavior
  message?: string
  updatedInput?: Record<string, unknown>
  decisionReason?: PermissionDecisionReason
}

export interface PermissionMetadata {
  toolName: string
  toolDescription?: string
  input: Record<string, any>
  mode: PermissionMode
  serverName?: string
  additionalInfo?: string
}

export interface YoloClassifierResult {
  behavior: PermissionBehavior
  reason?: string
  confidence?: number
}

export interface ClassifierUsage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

export interface PermissionContext {
  mode: PermissionMode
  alwaysAllowRules: Record<string, string[]>
  alwaysDenyRules: Record<string, string[]>
  alwaysAskRules: Record<string, string[]>
  shouldAvoidPermissionPrompts: boolean
}

export interface DenialTrackingState {
  consecutiveDenials: Map<string, number>
  totalDenials: Map<string, number>
}

// ============================================================================
// Permission Mode Constants
// ============================================================================

export const PERMISSION_MODES: readonly PermissionMode[] = [
  'default',
  'plan',
  'acceptEdits',
  'bypassPermissions',
  'dontAsk',
  'auto',
] as const

export const EXTERNAL_PERMISSION_MODES = ['default', 'plan', 'acceptEdits', 'bypassPermissions', 'dontAsk'] as const
export type ExternalPermissionMode = (typeof EXTERNAL_PERMISSION_MODES)[number]

export const PERMISSION_RULE_SOURCES: readonly PermissionRuleSource[] = [
  'localSettings',
  'userSettings',
  'projectSettings',
  'policySettings',
  'bundle',
  'plugin',
  'cliArg',
  'command',
  'session',
] as const

// ============================================================================
// Rule Parsing
// ============================================================================

export function permissionRuleFromString(ruleString: string): PermissionRuleValue {
  const parenIndex = ruleString.indexOf('(')
  if (parenIndex === -1) {
    return { toolName: ruleString }
  }
  const toolName = ruleString.slice(0, parenIndex)
  const ruleContent = ruleString.slice(parenIndex + 1, -1)
  return { toolName, ruleContent }
}

export function permissionRuleToString(rule: PermissionRuleValue): string {
  if (rule.ruleContent !== undefined) {
    return `${rule.toolName}(${rule.ruleContent})`
  }
  return rule.toolName
}

// ============================================================================
// Permission Check Pipeline (11-step, based on Claude Code)
// ============================================================================

export interface ToolPermissionCheckInput {
  toolName: string
  toolDescription?: string
  input: Record<string, any>
  context: PermissionContext
  isReadOnly: boolean
  isDestructive?: boolean
  serverName?: string
  denialState?: DenialTrackingState
}

export async function checkToolPermission(
  input: ToolPermissionCheckInput,
): Promise<PermissionDecision> {
  const { toolName, input: toolInput, context, isReadOnly } = input

  // Step 1: alwaysDeny rules
  for (const source of PERMISSION_RULE_SOURCES) {
    const rules = context.alwaysDenyRules[source] ?? []
    for (const ruleString of rules) {
      const rule = permissionRuleFromString(ruleString)
      if (matchesTool(toolName, rule, input.serverName)) {
        return {
          behavior: 'deny',
          decisionReason: { type: 'rule', rule: { source, ruleBehavior: 'deny', ruleValue: rule } },
          message: `Tool "${toolName}" is denied by rule "${permissionRuleToString(rule)}" from ${source}`,
        }
      }
    }
  }

  // Step 2: alwaysAllow rules
  for (const source of PERMISSION_RULE_SOURCES) {
    const rules = context.alwaysAllowRules[source] ?? []
    for (const ruleString of rules) {
      const rule = permissionRuleFromString(ruleString)
      if (matchesTool(toolName, rule, input.serverName)) {
        return {
          behavior: 'allow',
          decisionReason: { type: 'rule', rule: { source, ruleBehavior: 'allow', ruleValue: rule } },
          message: `Allowed by rule "${permissionRuleToString(rule)}"`,
        }
      }
    }
  }

  // Step 3: bypassPermissions mode
  if (context.mode === 'bypassPermissions' || context.mode === 'dontAsk') {
    if (context.mode === 'dontAsk') {
      return {
        behavior: 'deny',
        decisionReason: { type: 'mode', mode: 'dontAsk' },
        message: `Tool "${toolName}" is denied in "Don't Ask" mode`,
      }
    }
    return {
      behavior: 'allow',
      decisionReason: { type: 'mode', mode: 'bypassPermissions' },
    }
  }

  // Step 4: Read-only tools in acceptEdits mode
  if (context.mode === 'acceptEdits' && isReadOnly) {
    return {
      behavior: 'allow',
      decisionReason: { type: 'mode', mode: 'acceptEdits' },
      message: `Read-only tool "${toolName}" allowed in "Accept Edits" mode`,
    }
  }

  // Step 5: Plan mode check
  if (context.mode === 'plan') {
    // In plan mode, only allow reads — deny writes
    if (isReadOnly) {
      return {
        behavior: 'allow',
        decisionReason: { type: 'mode', mode: 'plan' },
      }
    }
    return {
      behavior: 'deny',
      decisionReason: { type: 'mode', mode: 'plan' },
      message: `Destructive tool "${toolName}" is denied in Plan mode`,
    }
  }

  // Step 6: alwaysAsk rules
  for (const source of PERMISSION_RULE_SOURCES) {
    const rules = context.alwaysAskRules[source] ?? []
    for (const ruleString of rules) {
      const rule = permissionRuleFromString(ruleString)
      if (matchesTool(toolName, rule, input.serverName)) {
        return {
          behavior: 'ask',
          decisionReason: { type: 'rule', rule: { source, ruleBehavior: 'ask', ruleValue: rule } },
          message: `Tool "${toolName}" requires approval (alwaysAsk rule from ${source})`,
        }
      }
    }
  }

  // Step 7: Destructive tools always require ask in default mode
  if (input.isDestructive && context.mode === 'default') {
    return {
      behavior: 'ask',
      decisionReason: { type: 'safetyCheck', classifierApprovable: true },
      message: `Destructive tool "${toolName}" requires approval`,
      updatedInput: toolInput,
    }
  }

  // Step 8: Default mode allows non-destructive tools
  if (context.mode === 'default') {
    return {
      behavior: 'allow',
      decisionReason: { type: 'other', reason: 'Default mode allows non-destructive tools' },
    }
  }

  // Step 9: acceptEdits mode — check input-specific rules
  if (context.mode === 'acceptEdits') {
    return {
      behavior: 'allow',
      decisionReason: { type: 'mode', mode: 'acceptEdits' },
    }
  }

  // Step 10: Auto mode — delegate to classifier
  if (context.mode === 'auto') {
    return {
      behavior: 'ask',
      decisionReason: { type: 'classifier', classifier: 'pending' },
      message: `Auto mode requires classifier decision for "${toolName}"`,
    }
  }

  // Step 11: Fallback — ask
  return {
    behavior: 'ask',
    decisionReason: { type: 'other', reason: 'No matching rule found' },
    message: `Tool "${toolName}" requires approval`,
  }
}

// ============================================================================
// Tool Matching
// ============================================================================

function matchesTool(toolName: string, rule: PermissionRuleValue, serverName?: string): boolean {
  // Direct match
  if (rule.toolName === toolName) return true

  // MCP server-level match: rule "server1" matches tool "server1__tool1"
  if (serverName && rule.toolName === serverName) return true

  // Wildcard: rule "mcp__*" matches all MCP tools
  if (rule.toolName.endsWith('__*')) {
    const prefix = rule.toolName.slice(0, -3)
    return toolName.startsWith(prefix)
  }

  return false
}

// ============================================================================
// Denial Tracking
// ============================================================================

export const DENIAL_LIMITS = {
  consecutive: 3,
  total: 5,
}

export function createDenialTrackingState(): DenialTrackingState {
  return {
    consecutiveDenials: new Map(),
    totalDenials: new Map(),
  }
}

export function recordDenial(state: DenialTrackingState, toolName: string): void {
  const consecutive = (state.consecutiveDenials.get(toolName) ?? 0) + 1
  const total = (state.totalDenials.get(toolName) ?? 0) + 1
  state.consecutiveDenials.set(toolName, consecutive)
  state.totalDenials.set(toolName, total)
}

export function recordSuccess(state: DenialTrackingState, toolName: string): void {
  state.consecutiveDenials.set(toolName, 0)
}

export function shouldFallbackToPrompting(state: DenialTrackingState, toolName: string): boolean {
  const consecutive = state.consecutiveDenials.get(toolName) ?? 0
  const total = state.totalDenials.get(toolName) ?? 0
  return consecutive >= DENIAL_LIMITS.consecutive || total >= DENIAL_LIMITS.total
}

// ============================================================================
// YOLO Classifier (2-stage: fast XML + thinking escalation)
// ============================================================================

export interface YoloClassifierInput {
  toolName: string
  input: Record<string, any>
  toolDescription?: string
  mode: PermissionMode
  denialState?: DenialTrackingState
}

export async function classifyYoloAction(
  input: YoloClassifierInput,
): Promise<PermissionDecision> {
  const { toolName, input: toolInput, mode } = input

  // Stage 1: Fast path — deterministic rules
  const fastDecision = fastPathClassifier(toolName, toolInput)
  if (fastDecision) {
    return fastDecision
  }

  // Stage 2: Escalation — use AI classifier
  try {
    const aiDecision = await aiClassifier(toolName, toolInput, mode)
    return aiDecision
  } catch {
    // Classifier unavailable — fall back to ask
    return {
      behavior: 'ask',
      decisionReason: { type: 'classifier', classifier: 'unavailable' },
      message: `Classifier unavailable for "${toolName}"`,
    }
  }
}

function fastPathClassifier(toolName: string, input: Record<string, any>): PermissionDecision | null {
  // Read-only tools always allowed
  if (toolName === 'Read' || toolName === 'Glob' || toolName === 'Grep') {
    return {
      behavior: 'allow',
      decisionReason: { type: 'classifier', classifier: 'fast_path' },
    }
  }

  // File writes to known-safe paths
  if (toolName === 'Write' || toolName === 'Edit') {
    const filePath = String(input.file_path ?? input.filePath ?? '')
    if (filePath.includes('test') || filePath.includes('/.claude/') || filePath.includes('\\.claude\\')) {
      return {
        behavior: 'allow',
        decisionReason: { type: 'classifier', classifier: 'fast_path' },
      }
    }
  }

  // Bash commands — delegate to BashParser classifyCommand
  if (toolName === 'Bash') {
    const cmd = String(input.command ?? '').trim()
    if (!cmd) return null

    // Check for injection first
    const injection = detectInjections(cmd)
    if (injection.hasInjection) {
      return {
        behavior: 'deny',
        decisionReason: { type: 'safetyCheck', reason: 'Injection detected' },
        message: `Command denied: ${injection.warnings.join('; ')}`,
      }
    }

    const plainClassified = classifyCommand(cmd)
    const parsed = parseShellCommand(cmd)
    const arityEnriched = enrichCommandClassification(parsed, defaultArityResolver)
    const classified = arityEnriched.category !== 'unknown' ? arityEnriched : plainClassified

    if (classified.risk === 'dangerous' || classified.isDestructive) {
      const dangerousPatterns = ['rm -rf /', 'rm -rf ~', ':(){ :|:& };:', 'dd if=', '> /dev/sda', 'mkfs.']
      if (dangerousPatterns.some(p => cmd.includes(p))) {
        return {
          behavior: 'deny',
          decisionReason: { type: 'classifier', classifier: 'fast_path' },
          message: `Dangerous command: ${classified.category}`,
        }
      }
    }

    if (classified.isReadOnly) {
      return {
        behavior: 'allow',
        decisionReason: { type: 'classifier', classifier: 'fast_path' },
      }
    }
  }

  return null
}

async function aiClassifier(
  toolName: string,
  input: Record<string, any>,
  mode: PermissionMode,
): Promise<PermissionDecision> {
  const fastXml = formatActionForClassifier(toolName, input)

  try {
    const response = await queryClassifier(fastXml, mode)
    const decision = parseClassifierResponse(response)
    return decision
  } catch {
    return {
      behavior: 'ask',
      decisionReason: { type: 'classifier', classifier: 'error' },
    }
  }
}

export function formatActionForClassifier(toolName: string, input: Record<string, any>): string {
  const entries = Object.entries(input)
    .map(([k, v]) => `  <${k}>${String(v).slice(0, 500)}</${k}>`)
    .join('\n')

  return `<action>\n  <tool>${toolName}</tool>\n${entries}\n</action>`
}

function parseClassifierResponse(response: string): PermissionDecision {
  const allowMatch = response.match(/<decision>\s*allow\s*<\/decision>/i)
  const denyMatch = response.match(/<decision>\s*deny\s*<\/decision>/i)

  if (allowMatch) {
    return {
      behavior: 'allow',
      decisionReason: { type: 'classifier', classifier: 'ai' },
    }
  }
  if (denyMatch) {
    return {
      behavior: 'deny',
      decisionReason: { type: 'classifier', classifier: 'ai' },
      message: 'Classifier denied this action',
    }
  }

  return {
    behavior: 'ask',
    decisionReason: { type: 'classifier', classifier: 'unclear' },
  }
}

async function queryClassifier(actionXml: string, _mode: PermissionMode): Promise<string> {
  const systemPrompt = `You are a permission classifier. Given an XML description of a tool action, determine whether it should be allowed, denied, or if the user should be asked.

Respond with XML:
<decision>allow</decision> or <decision>deny</decision> or <decision>ask</decision>
<reason>Brief explanation</reason>`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 128,
        system: systemPrompt,
        messages: [{ role: 'user', content: actionXml }],
      }),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    return data.content?.[0]?.text ?? '<decision>ask</decision>'
  } catch {
    throw new Error('Classifier API unavailable')
  }
}

// ============================================================================
// Utility
// ============================================================================

export function getModeConfig(mode: PermissionMode) {
  switch (mode) {
    case 'default':
      return { title: 'Default', shortTitle: 'Default', external: 'default' as const }
    case 'plan':
      return { title: 'Plan Mode', shortTitle: 'Plan', external: 'plan' as const }
    case 'acceptEdits':
      return { title: 'Accept Edits', shortTitle: 'Accept', external: 'acceptEdits' as const }
    case 'bypassPermissions':
      return { title: 'Bypass Permissions', shortTitle: 'Bypass', external: 'bypassPermissions' as const }
    case 'dontAsk':
      return { title: "Don't Ask", shortTitle: 'DontAsk', external: 'dontAsk' as const }
    case 'auto':
      return { title: 'Auto Mode', shortTitle: 'Auto', external: 'default' as const }
  }
}

export function permissionModeFromString(str: string): PermissionMode {
  return PERMISSION_MODES.includes(str as PermissionMode) ? (str as PermissionMode) : 'default'
}
