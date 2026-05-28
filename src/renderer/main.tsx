import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { getJobManager, getJobProcessor, registerBuiltinHandlers } from './services/BackgroundJobs'
import { getConfigResolver } from './services/ConfigResolver'
import { setupBrowserMode } from './services/BrowserPolyfill'
import './index.css'

// Setup browser mode polyfill before anything else
setupBrowserMode()

// Apply theme before render
try {
  const stored = localStorage.getItem('opendesktop-storage-v3')
  const root = document.documentElement
  const body = document.body
  if (stored) {
    const parsed = JSON.parse(stored)
    const theme = parsed.state?.settings?.theme
    if (theme === 'light') {
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
      body.style.background = '#ffffff'
      body.style.color = '#09090b'
    } else if (theme === 'dark') {
      root.classList.add('dark')
      root.style.colorScheme = 'dark'
      body.style.background = '#09090b'
      body.style.color = '#fafafa'
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
      root.style.colorScheme = prefersDark ? 'dark' : 'light'
      body.style.background = prefersDark ? '#09090b' : '#ffffff'
      body.style.color = prefersDark ? '#fafafa' : '#09090b'
    }
  } else {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
    body.style.background = '#09090b'
    body.style.color = '#fafafa'
  }
} catch {
  document.documentElement.classList.add('dark')
  document.body.style.background = '#09090b'
  document.body.style.color = '#fafafa'
}

// Register global store refs for cross-store access
import { useChatStore } from './store/chatStore'
;(window as any).__ZUSTAND_STORE__ = { chatStore: useChatStore }

// Initialize background jobs
const jobManager = getJobManager()
registerBuiltinHandlers(jobManager)
const jobProcessor = getJobProcessor()
jobProcessor.start()

// Initialize config resolver
try { getConfigResolver() } catch { /* config loader available on first access */ }

// Error boundary wrapper
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: { padding: '2rem', color: '#f87171', fontFamily: 'monospace' },
      }, React.createElement('h2', null, 'Renderer Error'), React.createElement('pre', null, this.state.error))
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  React.createElement(ErrorBoundary, null,
    React.createElement(React.StrictMode, null,
      React.createElement(App)
    )
  )
)
