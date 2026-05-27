export interface SystemContext {
  gitStatus?: string
  currentDate: string
  os: string
  cwd: string
  nodeVersion: string
  screenResolution?: string
}

let cachedContext: SystemContext | null = null

export async function getSystemContext(): Promise<SystemContext> {
  if (cachedContext) return cachedContext

  const context: SystemContext = {
    currentDate: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    os: navigator.platform,
    cwd: window.location.pathname,
    nodeVersion: navigator.userAgent,
  }

  try {
    const size = await window.electron.computer.getScreenSize()
    context.screenResolution = `${size.width}x${size.height}`
  } catch {
    context.screenResolution = `${window.screen.width}x${window.screen.height}`
  }

  cachedContext = context
  return context
}

export function buildContextPrompt(context: SystemContext): string {
  const lines = [
    `Current date: ${context.currentDate}`,
    `Operating system: ${context.os}`,
    `Screen resolution: ${context.screenResolution}`,
  ]

  if (context.gitStatus) {
    lines.push(
      'This is the git status at the start of the conversation. Note that this status is a snapshot in time, and will not update during the conversation.',
      `Git status:\n${context.gitStatus}`
    )
  }

  return lines.join('\n\n')
}

export function clearContextCache(): void {
  cachedContext = null
}
