export interface SystemContext {
  currentDate: string
  currentTime: string
  os: string
  platform: string
  arch: string
  nodeVersion: string
  cwd: string
  homeDir: string
  tempDir: string
  isGitRepo: boolean
  workspacePath: string
}

export interface GitContext {
  branch: string
  mainBranch: string
  status: string
  recentCommits: string
  userName: string
  userEmail: string
}

export interface ProjectContext {
  name: string
  language: string
  framework: string
  packageManager: string
  hasCLAUDEmd: boolean
  claudeMdContent: string | null
  fileCount: number
  structure: string
}

export interface InjectedContext {
  system: SystemContext
  git: GitContext | null
  project: ProjectContext | null
  cacheBreaker: string | null
}

let cachedContext: InjectedContext | null = null
let lastCwd: string | null = null

export async function getSystemContext(cwd?: string): Promise<SystemContext> {
  return {
    currentDate: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    currentTime: new Date().toLocaleTimeString(),
    os: navigator.userAgent.includes('Windows') ? 'Windows' : navigator.userAgent.includes('Mac') ? 'macOS' : 'Linux',
    platform: navigator.platform,
    arch: 'x64',
    nodeVersion: 'N/A (browser)',
    cwd: cwd || '/',
    homeDir: '/',
    tempDir: '/tmp',
    isGitRepo: false,
    workspacePath: cwd || '/',
  }
}

export async function getGitContext(cwd?: string): Promise<GitContext | null> {
  if (typeof window === 'undefined') return null

  try {
    const workingDir = cwd || '/'

    // Try Electron API via window.electron
    const electron = (window as any).electron
    if (!electron?.gitStatus) return null

    const result = await electron.gitStatus(workingDir)
    if (!result?.success) return null

    const isRepo = await electron.gitIsRepo?.(workingDir)
    if (!isRepo) return null

    return {
      branch: result.branch || 'unknown',
      mainBranch: result.mainBranch || 'main',
      status: result.status || '',
      recentCommits: result.log || '',
      userName: '',
      userEmail: '',
    }
  } catch {
    return null
  }
}

export async function getProjectContext(cwd?: string): Promise<ProjectContext | null> {
  if (typeof window === 'undefined') return null

  try {
    const workingDir = cwd || '/'

    // Check for CLAUDE.md
    let claudeMdContent: string | null = null
    let hasCLAUDEmd = false

    const electron = (window as any).electron
    if (electron?.fileRead) {
      try {
        const claudeMd = await electron.fileRead(`${workingDir}/CLAUDE.md`)
        if (claudeMd?.success) {
          hasCLAUDEmd = true
          claudeMdContent = claudeMd.content
        }
      } catch { /* ignore */ }
    }

    return {
      name: workingDir.split('/').pop() || 'unknown',
      language: 'unknown',
      framework: 'unknown',
      packageManager: 'unknown',
      hasCLAUDEmd,
      claudeMdContent,
      fileCount: 0,
      structure: '',
    }
  } catch {
    return null
  }
}

export async function getInjectedContext(cwd?: string): Promise<InjectedContext> {
  const currentCwd = cwd || '/'

  // Invalidate cache if cwd changed
  if (lastCwd !== currentCwd) {
    cachedContext = null
    lastCwd = currentCwd
  }

  if (cachedContext) return cachedContext

  const system = await getSystemContext(currentCwd)
  const git = await getGitContext(currentCwd)
  const project = await getProjectContext(currentCwd)

  cachedContext = {
    system,
    git,
    project,
    cacheBreaker: null,
  }

  return cachedContext
}

export function formatContextForPrompt(context: InjectedContext): string {
  const sections: string[] = []

  // System info
  sections.push(`# System Context
- Date: ${context.system.currentDate} ${context.system.currentTime}
- OS: ${context.system.os}
- Working Directory: ${context.system.cwd}`)

  // Git context
  if (context.git) {
    sections.push(`# Git Context
- Branch: ${context.git.branch}
- Main Branch: ${context.git.mainBranch}
- Recent Commits:
${context.git.recentCommits ? context.git.recentCommits.split('\n').map((c) => `  - ${c}`).join('\n') : '  (none)'}
${context.git.status ? `\n- Working Tree Status:\n${context.git.status}` : ''}`)
  }

  // Project context
  if (context.project) {
    sections.push(`# Project: ${context.project.name}
- Language: ${context.project.language}
- Framework: ${context.project.framework}
- Package Manager: ${context.project.packageManager}
${context.project.hasCLAUDEmd ? `\n## CLAUDE.md (Project Conventions)\n${context.project.claudeMdContent}` : '\nNo CLAUDE.md found. Use /init to generate one.'}`)
  }

  return sections.join('\n\n')
}

export function invalidateContextCache() {
  cachedContext = null
  lastCwd = null
}
