import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import path from 'path'
import { app } from 'electron'

const exec = promisify(execFile)

export interface SystemContext {
  currentDate: string
  os: string
  platform: string
  arch: string
  nodeVersion: string
  cwd: string
  homeDir: string
  tempDir: string
  gitStatus?: string
  gitBranch?: string
  gitLog?: string
  isGitRepo: boolean
  workspacePath: string
}

export async function getSystemContext(cwd?: string): Promise<SystemContext> {
  const workingDir = cwd || app.getPath('home')

  const context: SystemContext = {
    currentDate: new Date().toISOString(),
    os: os.type(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    cwd: workingDir,
    homeDir: os.homedir(),
    tempDir: os.tmpdir(),
    isGitRepo: false,
    workspacePath: workingDir,
  }

  try {
    const gitDir = await exec('git', ['rev-parse', '--git-dir'], { cwd: workingDir })
    context.isGitRepo = true

    const [branch, status, log] = await Promise.all([
      exec('git', ['branch', '--show-current'], { cwd: workingDir }).catch(() => ({ stdout: 'unknown' })),
      exec('git', ['status', '--short'], { cwd: workingDir }).catch(() => ({ stdout: '' })),
      exec('git', ['log', '--oneline', '-n', '10'], { cwd: workingDir }).catch(() => ({ stdout: '' })),
    ])

    context.gitBranch = branch.stdout.trim()
    context.gitStatus = status.stdout.trim()
    context.gitLog = log.stdout.trim()
  } catch {
    context.isGitRepo = false
  }

  return context
}

export function formatSystemPrompt(context: SystemContext): string {
  const parts = [
    `# System Context`,
    `- Date: ${context.currentDate}`,
    `- OS: ${context.os} (${context.arch})`,
    `- Platform: ${context.platform}`,
    `- Node: ${context.nodeVersion}`,
    `- Working Directory: ${context.cwd}`,
    `- Home: ${context.homeDir}`,
  ]

  if (context.isGitRepo) {
    parts.push(
      `# Git Context`,
      `- Branch: ${context.gitBranch}`,
      `- Status: ${context.gitStatus || 'clean'}`,
      `- Recent Commits:`,
      context.gitLog?.split('\n').map((l) => `  ${l}`).join('\n') || '  None'
    )
  }

  return parts.join('\n')
}

export function formatMemoryPrompt(memories: Array<{ category: string; content: string }>): string {
  if (memories.length === 0) return ''

  const grouped: Record<string, string[]> = {}
  memories.forEach((m) => {
    if (!grouped[m.category]) grouped[m.category] = []
    grouped[m.category].push(m.content)
  })

  const parts = ['# User Memory']
  for (const [category, items] of Object.entries(grouped)) {
    parts.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)}s`)
    items.forEach((item) => parts.push(`- ${item}`))
  }

  return parts.join('\n')
}

export function formatToolUsagePrompt(recentTools: Array<{ name: string; result: string }>): string {
  if (recentTools.length === 0) return ''

  const parts = ['# Recent Tool Usage']
  recentTools.forEach((tool, i) => {
    parts.push(`## ${i + 1}. ${tool.name}`)
    parts.push(tool.result)
  })

  return parts.join('\n')
}
