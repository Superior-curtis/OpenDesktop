import { electronAvailable } from './IpcClient'

export type ElectronApiStatus = 'available' | 'mock' | 'unavailable'

export function getElectronStatus(): ElectronApiStatus {
  try {
    if (electronAvailable()) return 'available'
    if (typeof window !== 'undefined') return 'mock'
    return 'unavailable'
  } catch {
    return 'unavailable'
  }
}

export function getPlatformInfo(): { platform: string; arch: string; version: string } {
  try {
    if (electronAvailable()) {
      return { platform: navigator.platform, arch: '', version: '' }
    }
  } catch { /* fall through */ }
  return { platform: navigator.platform, arch: '', version: '0.0.0' }
}

export function getHomeDir(): string {
  try {
    const home = (typeof process !== 'undefined' && process.env?.HOME) || (typeof process !== 'undefined' && process.env?.USERPROFILE) || ''
    return home
  } catch { /* ignore */ }
  return ''
}

export function getDefaultShell(): string {
  const p = typeof navigator !== 'undefined' ? navigator.platform : ''
  if (p.includes('Win')) return 'powershell.exe'
  return '/bin/bash'
}

export function getDataDir(): string {
  const home = (typeof process !== 'undefined' && process.env?.HOME) || ''
  const appData = (typeof process !== 'undefined' && process.env?.APPDATA) || ''
  const p = typeof navigator !== 'undefined' ? navigator.platform : ''
  if (p.includes('Win')) return appData
  if (p.includes('Mac')) return home ? `${home}/Library/Application Support` : ''
  return home ? `${home}/.config` : ''
}

export function sanitizePath(p: string): string {
  return p.replace(/\.\.\//g, '').replace(/\.\.\\/g, '')
}
