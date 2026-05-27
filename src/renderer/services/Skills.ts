// ============================================================================
// Skill Types
// ============================================================================

export type LoadedFrom = 'skills' | 'plugin' | 'managed' | 'bundled' | 'mcp' | 'commands_DEPRECATED'

export type SettingSource = 'policySettings' | 'userSettings' | 'projectSettings' | 'builtin' | 'plugin' | 'mcp' | 'bundled'

export type SkillContext = 'inline' | 'fork'

export interface Skill {
  type: 'prompt'
  name: string
  displayName?: string
  description: string
  whenToUse?: string
  content: string
  contentLength: number
  progressMessage: string
  source: SettingSource
  loadedFrom: LoadedFrom
  allowedTools?: string[]
  model?: string
  paths?: string[]
  context?: SkillContext
  agent?: string
  effort?: string
  argNames?: string[]
  hooks?: Record<string, unknown>
  skillRoot?: string
}

export interface SkillWithPath {
  skill: Skill
  filePath: string
}

export interface SkillListingEntry {
  name: string
  description: string
  whenToUse?: string
}

// ============================================================================
// Skill Discovery Types
// ============================================================================

export interface SkillDiscoveryResult {
  skills: SkillListingEntry[]
  source: 'native' | 'aki' | 'both'
}

export interface DiscoveredSkill {
  name: string
  description: string
  shortId?: string
}

// ============================================================================
// Constants
// ============================================================================

export const MAX_LISTING_DESC_CHARS = 250
export const SKILL_BUDGET_CONTEXT_PERCENT = 0.01
export const CHARS_PER_TOKEN = 4
export const DEFAULT_CHAR_BUDGET = 8_000

// ============================================================================
// Skill Directory Discovery
// ============================================================================

export async function discoverSkillDirs(filePaths: string[], cwd: string): Promise<string[]> {
  const newDirs: string[] = []
  const seen = new Set<string>()

  for (const filePath of filePaths) {
    let currentDir = filePath.replace(/[/\\][^/\\]*$/, '')

    while (currentDir.startsWith(cwd)) {
      // Support both .claude/skills and .opendesktop/skills
      for (const skillDirName of ['.claude/skills', '.opendesktop/skills']) {
        const skillDir = joinPath(currentDir, skillDirName)

        if (!seen.has(skillDir)) {
          seen.add(skillDir)
          try {
            const exists = await checkDirExists(skillDir)
            if (exists) {
              newDirs.push(skillDir)
            }
          } catch {
            // Directory doesn't exist, skip
          }
        }
      }

      const parent = currentDir.replace(/[/\\]+$/, '').replace(/[/\\][^/\\]*$/, '')
      if (parent === currentDir) break
      currentDir = parent
    }
  }

  return newDirs.sort((a, b) => b.split(/[/\\]/).length - a.split(/[/\\]/).length)
}

async function checkDirExists(dir: string): Promise<boolean> {
  try {
    const result = await window.api.glob('*', dir)
    return Array.isArray(result) && result.length >= 0
  } catch {
    return false
  }
}

// ============================================================================
// Load Skills from Directory
// ============================================================================

export interface SkillFile {
  name: string
  content: string
  filePath: string
}

export async function loadSkillsFromDir(skillDir: string, source: SettingSource): Promise<SkillWithPath[]> {
  try {
    if (typeof window === 'undefined' || !window.api || typeof window.api.glob !== 'function') {
      return []
    }

    // Use glob to find all SKILL.md files in subdirectories
    const globResult = await window.api.glob('*/SKILL.md', skillDir)
    if (!Array.isArray(globResult) || globResult.length === 0) return []

    const results: SkillWithPath[] = []

    for (const relativePath of globResult) {
      // relativePath is like "skillname/SKILL.md"
      const parts = relativePath.replace(/\\/g, '/').split('/')
      if (parts.length < 2) continue
      const skillName = parts[parts.length - 2]
      const skillFilePath = joinPath(skillDir, relativePath)

      try {
        const fileResult = await window.api.readFile(skillFilePath)
        if (!fileResult) continue

        const { frontmatter, content: markdownContent } = parseFrontmatter(fileResult, skillFilePath)
        const parsed = parseSkillFrontmatter(frontmatter, markdownContent, skillName)

        const skill = createSkill({
          ...parsed,
          name: skillName,
          displayName: frontmatter.display_name ?? frontmatter.displayName,
          markdownContent,
          source,
          skillRoot: skillDir,
          loadedFrom: 'skills' as LoadedFrom,
        })

        results.push({ skill, filePath: skillFilePath })
      } catch {
        continue
      }
    }

    return results
  } catch {
    return []
  }
}

export async function loadSkillFromPath(skillDirPath: string, skillName: string, source: SettingSource): Promise<SkillWithPath | null> {
  const skillFilePath = joinPath(skillDirPath, 'SKILL.md')
  try {
    const content = await window.api.readFile(skillFilePath)
    const { frontmatter, content: markdownContent } = parseFrontmatter(content, skillFilePath)
    const parsed = parseSkillFrontmatter(frontmatter, markdownContent, skillName)

    return {
      skill: createSkill({
        ...parsed,
        name: skillName,
        markdownContent,
        source,
        skillRoot: skillDirPath,
        loadedFrom: 'skills' as LoadedFrom,
      }),
      filePath: skillFilePath,
    } as SkillWithPath
  } catch {
    return null
  }
}

// ============================================================================
// Frontmatter Parsing
// ============================================================================

export function parseFrontmatter(content: string, _sourcePath?: string): {
  frontmatter: Record<string, any>
  content: string
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, content }
  }

  const frontmatter: Record<string, any> = {}
  const lines = match[1].split('\n')

  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value: any = line.slice(colonIndex + 1).trim()

    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (/^\d+$/.test(value)) value = parseInt(value, 10)

    frontmatter[key] = value
  }

  return { frontmatter, content: match[2].trim() }
}

export function parseSkillFrontmatter(
  frontmatter: Record<string, any>,
  _markdownContent: string,
  _resolvedName: string,
  descriptionFallback = 'Skill',
) {
  const description = frontmatter.description ?? descriptionFallback
  const whenToUse = frontmatter.when_to_use ?? frontmatter.whenToUse
  const paths = parsePathsField(frontmatter.paths)
  const allowedTools = parseArrayField(frontmatter.allowed_tools ?? frontmatter.allowedTools)
  const argNames = parseArrayField(frontmatter.argument_names ?? frontmatter.argNames)
  const model = frontmatter.model
  const effort = frontmatter.effort
  const context = frontmatter.context as SkillContext | undefined
  const agent = frontmatter.agent

  return {
    description,
    hasUserSpecifiedDescription: !!frontmatter.description,
    whenToUse,
    paths,
    allowedTools,
    argNames,
    model,
    effort,
    context,
    agent,
  }
}

function parsePathsField(paths: any): string[] | undefined {
  if (!paths) return undefined
  if (typeof paths === 'string') {
    const patterns = paths.split(',').map((p: string) => p.trim()).filter(Boolean)
    return patterns.every((p: string) => p === '**') ? undefined : patterns
  }
  if (Array.isArray(paths)) {
    return paths.every((p: string) => p === '**') ? undefined : paths
  }
  return undefined
}

function parseArrayField(value: any): string[] | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value.split(',').map((s: string) => s.trim()).filter(Boolean)
  if (Array.isArray(value)) return value
  return undefined
}

// ============================================================================
// Skill Creation
// ============================================================================

export function createSkill(params: {
  name: string
  displayName?: string
  description: string
  whenToUse?: string
  markdownContent: string
  source: SettingSource
  loadedFrom: LoadedFrom
  skillRoot?: string
  allowedTools?: string[]
  argNames?: string[]
  model?: string
  effort?: string
  context?: SkillContext
  agent?: string
  paths?: string[]
}): Skill {
  return {
    type: 'prompt',
    name: params.name,
    displayName: params.displayName,
    description: params.description,
    whenToUse: params.whenToUse,
    content: params.markdownContent,
    contentLength: params.markdownContent.length,
    progressMessage: `Running ${params.name} skill...`,
    source: params.source,
    loadedFrom: params.loadedFrom,
    allowedTools: params.allowedTools,
    model: params.model,
    effort: params.effort,
    context: params.context,
    agent: params.agent,
    argNames: params.argNames,
    skillRoot: params.skillRoot,
    paths: params.paths,
  }
}

// ============================================================================
// Two-Phase Skill Discovery
// ============================================================================

// Phase 1: Skill Listing (names + descriptions in context)
export function getSkillListing(skills: Skill[], charBudget = DEFAULT_CHAR_BUDGET): string {
  if (skills.length === 0) return ''

  const fullEntries = skills.map(formatSkillListingEntry)
  const fullTotal = fullEntries.join('\n').length

  if (fullTotal <= charBudget) {
    return fullEntries.join('\n')
  }

  const restEntries = fullEntries.map(e => e.split(':')[0])
  const restTotal = restEntries.join('\n').length

  if (restTotal <= charBudget) {
    return restEntries.join('\n')
  }

  let result = ''
  for (const name of restEntries) {
    if ((result + name).length + 1 > charBudget) break
    if (result) result += '\n'
    result += name
  }
  return result
}

function formatSkillListingEntry(skill: Skill): string {
  const desc = skill.whenToUse
    ? `${skill.description} - ${skill.whenToUse}`
    : skill.description
  const truncated = desc.length > MAX_LISTING_DESC_CHARS
    ? desc.slice(0, MAX_LISTING_DESC_CHARS - 1) + '…'
    : desc
  return `- ${skill.name}: ${truncated}`
}

// Phase 2: Skill Content (full SKILL.md on invocation)
export function getSkillContent(skill: Skill): string {
  const header = `--- Skill: ${skill.name} ---`
  const meta = [
    skill.description && `Description: ${skill.description}`,
    skill.whenToUse && `When to use: ${skill.whenToUse}`,
    skill.allowedTools?.length && `Allowed tools: ${skill.allowedTools.join(', ')}`,
    skill.model && `Model: ${skill.model}`,
    skill.effort && `Effort: ${skill.effort}`,
  ].filter(Boolean).join('\n')

  return `${header}\n${meta}\n\n${skill.content}`
}

// ============================================================================
// Dynamic Skill Discovery (inter-turn prefetch)
// ============================================================================

const dynamicSkills = new Map<string, Skill>()
const dynamicSkillDirs = new Set<string>()
const invokedSkills = new Map<string, Set<string>>()

export function getDynamicSkills(): Skill[] {
  return Array.from(dynamicSkills.values())
}

export function getSkill(name: string): Skill | undefined {
  return dynamicSkills.get(name)
}

export async function addSkillDirectories(dirs: string[]): Promise<void> {
  if (dirs.length === 0) return

  const loadedSkills = await Promise.all(
    dirs.map(dir => loadSkillsFromDir(dir, 'projectSettings')),
  )

  for (let i = loadedSkills.length - 1; i >= 0; i--) {
    for (const { skill } of loadedSkills[i] ?? []) {
      if (skill.type === 'prompt') {
        dynamicSkills.set(skill.name, skill)
      }
    }
  }
}

export function clearDynamicSkills(): void {
  dynamicSkills.clear()
  dynamicSkillDirs.clear()
}

export function addInvokedSkill(agentId: string, skillName: string): void {
  const skills = invokedSkills.get(agentId) ?? new Set()
  skills.add(skillName)
  invokedSkills.set(agentId, skills)
}

export function clearInvokedSkillsForAgent(agentId: string): void {
  invokedSkills.delete(agentId)
}

export function getInvokedSkillNames(agentId: string): Set<string> {
  return invokedSkills.get(agentId) ?? new Set()
}

// ============================================================================
// Prefetch Orchestration
// ============================================================================

export interface SkillPrefetchHandle {
  promise: Promise<DiscoveredSkill[]>
  settledAt: number | null
  consumedOnIteration: number
}

export function startSkillDiscoveryPrefetch(
  input: string | null,
  skills: Skill[],
): SkillPrefetchHandle | null {
  if (!input || skills.length === 0) return null

  const promise = discoverRelevantSkills(input, skills)

  return {
    promise: promise.then(results => results),
    settledAt: null,
    consumedOnIteration: -1,
  }
}

export async function collectSkillDiscoveryPrefetch(
  prefetch: SkillPrefetchHandle,
): Promise<DiscoveredSkill[]> {
  try {
    const results = await prefetch.promise
    prefetch.settledAt = Date.now()
    return results
  } catch {
    return []
  }
}

export async function getTurnZeroSkillDiscovery(
  input: string,
  skills: Skill[],
): Promise<DiscoveredSkill[]> {
  return discoverRelevantSkills(input, skills)
}

async function discoverRelevantSkills(
  input: string,
  skills: Skill[],
): Promise<DiscoveredSkill[]> {
  if (!input || skills.length === 0) return []

  const query = input.toLowerCase()
  const queryTokens = query.split(/\s+/).filter(t => t.length > 2)

  const matched: DiscoveredSkill[] = []

  for (const skill of skills) {
    const searchText = [
      skill.name,
      skill.description,
      skill.whenToUse,
    ].filter(Boolean).join(' ').toLowerCase()

    const score = computeRelevanceScore(queryTokens, searchText, skill.name.toLowerCase())
    if (score > 0) {
      matched.push({
        name: skill.name,
        description: skill.whenToUse ?? skill.description,
      })
    }

    if (matched.length >= 5) break
  }

  return matched.sort((a, b) => {
    const aName = skills.find(s => s.name === a.name)
    const bName = skills.find(s => s.name === b.name)
    return (bName?.contentLength ?? 0) - (aName?.contentLength ?? 0)
  })
}

function computeRelevanceScore(queryTokens: string[], searchText: string, skillName: string): number {
  let score = 0

  for (const token of queryTokens) {
    if (skillName.includes(token)) score += 3
    else if (searchText.includes(token)) score += 1
  }

  if (queryTokens.some(t => skillName === t)) score += 10

  return score
}

// ============================================================================
// Skill Merge (for post-compact cleanup)
// ============================================================================

export function mergeSkillsForPostCompact(
  currentSkills: Skill[],
  postCompactBudget = 25_000,
): Skill[] {
  const sorted = [...currentSkills].sort((a, b) => {
    const aScore = getSkillPriorityScore(a)
    const bScore = getSkillPriorityScore(b)
    return bScore - aScore
  })

  const result: Skill[] = []
  let budget = postCompactBudget

  for (const skill of sorted) {
    const cost = skill.contentLength
    if (cost <= budget) {
      result.push(skill)
      budget -= cost
    }
  }

  return result
}

function getSkillPriorityScore(skill: Skill): number {
  let score = 0
  if (skill.source === 'bundled') score += 100
  if (skill.source === 'builtin') score += 80
  if (skill.source === 'projectSettings') score += 50
  if (skill.source === 'plugin') score += 30
  return score
}

// ============================================================================
// Utilities
// ============================================================================

export function estimateSkillFrontmatterTokens(skill: Skill): number {
  const frontmatterText = [skill.name, skill.description, skill.whenToUse]
    .filter(Boolean)
    .join(' ')
  return Math.ceil(frontmatterText.length / 4)
}

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/')
}

// ============================================================================
// Re-exported Constants for Context Compaction
// ============================================================================

export const POST_COMPACT_MAX_SKILLS = 5
export const POST_COMPACT_MAX_TOKENS_PER_SKILL = 5_000
export const POST_COMPACT_SKILLS_TOKEN_BUDGET = 25_000
