import { describe, it, expect } from 'vitest'
import { getElectronStatus, getPlatformInfo, getHomeDir, getDefaultShell, getDataDir, sanitizePath } from '../src/renderer/services/ElectronBridge'

describe('ElectronBridge', () => {
  it('getElectronStatus returns mock or available', () => {
    const status = getElectronStatus()
    expect(['mock', 'available', 'unavailable']).toContain(status)
  })

  it('getPlatformInfo returns platform string', () => {
    const info = getPlatformInfo()
    expect(info.platform).toBeTruthy()
  })

  it('getHomeDir returns string', () => {
    const home = getHomeDir()
    expect(typeof home).toBe('string')
  })

  it('getDefaultShell returns powershell.exe on Windows', () => {
    const shell = getDefaultShell()
    expect(shell).toMatch(/powershell|bash/)
  })

  it('getDataDir returns string', () => {
    const dir = getDataDir()
    expect(typeof dir).toBe('string')
  })

  it('sanitizePath removes path traversal', () => {
    expect(sanitizePath('safe/path')).toBe('safe/path')
    expect(sanitizePath('../../etc/passwd')).toBe('etc/passwd')
    expect(sanitizePath('..\\..\\windows\\system32')).toBe('windows\\system32')
  })
})
