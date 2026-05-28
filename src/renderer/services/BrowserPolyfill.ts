// Browser polyfill — provides window.api for web/browser mode
// When running in Electron, the preload script provides these via contextBridge
// When running in browser, we use the WebApiClient's REST endpoints

import { webApi } from './WebApiClient'

export function setupBrowserMode(): boolean {
  // Skip if already in Electron
  if (typeof window !== 'undefined' && (window as any).electron) {
    return false
  }
  if (typeof window === 'undefined') return false

  // Polyfill window.api with web client
  ;(window as any).api = {
    readFile: webApi.readFile,
    writeFile: webApi.writeFile,
    executeCommand: webApi.executeCommand,
    glob: webApi.glob,
    grep: webApi.grep,
    webSearch: webApi.webSearch,
    webFetch: webApi.webFetch,
  }

  // Polyfill window.electron.api for chat
  ;(window as any).electron = {
    api: {
      chat: async (params: any) => {
        const { webChat } = await import('./WebApiClient')
        return webChat(params)
      },
      onStreamData: () => {},
      offStreamData: () => {},
      startStream: async () => ({ success: true }),
      testProvider: async () => ({ success: false, error: 'Not available in browser mode' }),
    },
    getAppVersion: async () => 'web-1.0.0',
    getPlatform: async () => navigator.platform || 'web',
    getUserDataPath: async () => '/tmp/opendesktop',
  }

  console.log('[OpenDesktop] Running in browser mode — using REST API')
  return true
}
