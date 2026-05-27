export interface PlatformInfo {
  platform: 'win32' | 'darwin' | 'linux'
  userAgent?: string
  homeDir: string
  dataDir: string
  cwd: string
}
