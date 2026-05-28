import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { setupBrowserMode } from './services/BrowserPolyfill'
import './index.css'

setupBrowserMode()

// Theme setup
try {
  const stored = localStorage.getItem('opendesktop-storage-v3')
  if (stored) {
    const parsed = JSON.parse(stored)
    const theme = parsed.state?.settings?.theme
    const root = document.documentElement
    if (theme === 'light') {
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
    } else {
      root.classList.add('dark')
      root.style.colorScheme = 'dark'
    }
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
