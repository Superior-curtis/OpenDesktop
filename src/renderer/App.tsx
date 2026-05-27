import { useState, useEffect, lazy, Suspense } from 'react'
import { ChatInterface } from './components'
import { ParticleLoader } from './components/ParticleLoader'
import { SessionTabs } from './components/SessionTabs'
import { ProjectSidebar } from './components/ProjectSidebar'
import { Onboarding } from './components/Onboarding'
import { useWorkspaceStore } from './store/workspaceStore'
import { useViewStore, ViewContainer, type ViewId } from './components/ViewSwitcher'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SidebarSkeleton } from './components/Skeleton'
import { FolderTree, PanelLeftClose, Settings2, Zap, Wrench, Terminal, Bot, Plug, Keyboard, Search, FolderOpen } from 'lucide-react'
import { getConfigResolver } from './services/ConfigResolver'
import { getSettingsManager, applyConfigToSettings, loadPersistedSettings } from './services/SettingsManager'
import { ToastContainer } from './components/ToastContainer'
import { useNotificationsStore } from './store/notificationsStore'
import { getKeybindingManager } from './services/Keybindings'
import { exportAllData, downloadExport, readImportFile, importAllData } from './services/ExportImport'

const LazySettingsPanel = lazy(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })))
const LazyProviderConfig = lazy(() => import('./components/ProviderConfigPanel').then(m => ({ default: m.ProviderConfigPanel })))
const LazySkillsPanel = lazy(() => import('./components/SkillsPanel').then(m => ({ default: m.SkillsPanel })))
const LazyToolsPanel = lazy(() => import('./components/ToolsPanel').then(m => ({ default: m.ToolsPanel })))
const LazyAgentConfig = lazy(() => import('./components/AgentConfigPanel').then(m => ({ default: m.AgentConfigPanel })))
const LazyMcpServerPanel = lazy(() => import('./components/McpServerPanel').then(m => ({ default: m.McpServerPanel })))
const LazyKeyboardShortcutsPanel = lazy(() => import('./components/KeyboardShortcutsPanel').then(m => ({ default: m.KeyboardShortcutsPanel })))
const LazyChatSearchPanel = lazy(() => import('./components/ChatSearchPanel').then(m => ({ default: m.ChatSearchPanel })))
const LazyFileExplorer = lazy(() => import('./components/FileExplorer').then(m => ({ default: m.FileExplorer })))

const VIEW_NAV_ITEMS: { id: ViewId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'chat', label: 'Chat', icon: () => null },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'settings', label: 'Settings', icon: Settings2 },
  { id: 'provider-config', label: 'Providers', icon: Zap },
  { id: 'mcp-servers', label: 'MCP', icon: Plug },
  { id: 'skills', label: 'Skills', icon: Wrench },
  { id: 'tools', label: 'Tools', icon: Terminal },
  { id: 'agent-config', label: 'Agents', icon: Bot },
  { id: 'shortcuts', label: 'Keys', icon: Keyboard },
]

function ViewContent({ view }: { view: ViewId }) {
  switch (view) {
    case 'chat':
      return null
    case 'settings':
      return (
        <ErrorBoundary key="settings">
          <Suspense fallback={<SidebarSkeleton />}>
            <LazySettingsPanel />
          </Suspense>
        </ErrorBoundary>
      )
    case 'provider-config':
      return (
        <ErrorBoundary key="providers">
          <Suspense fallback={<SidebarSkeleton />}>
            <LazyProviderConfig />
          </Suspense>
        </ErrorBoundary>
      )
    case 'skills':
      return (
        <ErrorBoundary key="skills">
          <Suspense fallback={<SidebarSkeleton />}>
            <LazySkillsPanel />
          </Suspense>
        </ErrorBoundary>
      )
    case 'tools':
      return (
        <ErrorBoundary key="tools">
          <Suspense fallback={<SidebarSkeleton />}>
            <LazyToolsPanel />
          </Suspense>
        </ErrorBoundary>
      )
    case 'agent-config':
      return (
        <ErrorBoundary key="agents">
          <Suspense fallback={<SidebarSkeleton />}>
            <LazyAgentConfig />
          </Suspense>
        </ErrorBoundary>
      )
    case 'mcp-servers':
      return (
        <ErrorBoundary key="mcp">
          <Suspense fallback={<SidebarSkeleton />}>
            <LazyMcpServerPanel />
          </Suspense>
        </ErrorBoundary>
      )
    case 'shortcuts':
      return (
        <ErrorBoundary key="shortcuts">
          <Suspense fallback={<SidebarSkeleton />}>
            <LazyKeyboardShortcutsPanel />
          </Suspense>
        </ErrorBoundary>
      )
    case 'search':
      return (
        <ErrorBoundary key="search">
          <Suspense fallback={<SidebarSkeleton />}>
            <LazyChatSearchPanel />
          </Suspense>
        </ErrorBoundary>
      )
    case 'files':
      return (
        <ErrorBoundary key="files">
          <Suspense fallback={<SidebarSkeleton />}>
            <LazyFileExplorer />
          </Suspense>
        </ErrorBoundary>
      )
    default:
      return null
  }
}

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [showProjectSidebar, setShowProjectSidebar] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const { layout, sessions, activeSessionId } = useWorkspaceStore()
  const currentView = useViewStore((s) => s.currentView)

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('opendesktop-onboarding')
    if (!hasSeenOnboarding) {
      setTimeout(() => setShowOnboarding(true), 300)
    } else {
      setTimeout(() => {
        useNotificationsStore.getState().addNotification({
          type: 'info',
          title: 'Welcome back',
          message: `${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
          duration: 3000,
        })
      }, 500)
    }

    // Register keyboard view navigation shortcuts
    try {
      const km = getKeybindingManager()
      const navigate = (view: ViewId) => useViewStore.getState().navigate(view)
      const goBack = () => useViewStore.getState().goBack()

      km.register({
        id: 'view-go-back', keys: 'escape', description: 'Go back to previous view', category: 'navigation', chords: [], handler: () => goBack(), enabled: true, when: '!chatView',
      })

      const viewNavBindings: { id: string; keys: string; view: ViewId }[] = [
        { id: 'nav-chat', keys: 'ctrl+1', view: 'chat' },
        { id: 'nav-search', keys: 'ctrl+2', view: 'search' },
        { id: 'nav-files', keys: 'ctrl+3', view: 'files' },
        { id: 'nav-settings', keys: 'ctrl+4', view: 'settings' },
        { id: 'nav-providers', keys: 'ctrl+5', view: 'provider-config' },
        { id: 'nav-mcp', keys: 'ctrl+6', view: 'mcp-servers' },
        { id: 'nav-skills', keys: 'ctrl+7', view: 'skills' },
        { id: 'nav-tools', keys: 'ctrl+8', view: 'tools' },
        { id: 'nav-agents', keys: 'ctrl+9', view: 'agent-config' },
      ]
      for (const vb of viewNavBindings) {
        km.register({
          id: vb.id, keys: vb.keys, description: `Navigate to ${vb.view}`, category: 'navigation', chords: [], handler: () => navigate(vb.view), enabled: true,
        })
      }

      // Export/import shortcuts
      km.register({
        id: 'export-data', keys: 'ctrl+shift+e', description: 'Export all data', category: 'general', chords: [], handler: () => { const data = exportAllData(); downloadExport(data); useNotificationsStore.getState().addNotification({ type: 'success', title: 'Export complete', message: 'All data exported successfully', duration: 3000 }) }, enabled: true,
      })
      km.register({
        id: 'import-data', keys: 'ctrl+shift+i', description: 'Import data from file', category: 'general', chords: [], handler: async () => { try { const json = await readImportFile(); const result = importAllData(json); useNotificationsStore.getState().addNotification({ type: result.success ? 'success' : 'error', title: result.success ? 'Import complete' : 'Import failed', message: result.success ? 'Data imported successfully' : result.error, duration: 4000 }) } catch (e) { useNotificationsStore.getState().addNotification({ type: 'error', title: 'Import failed', message: e instanceof Error ? e.message : 'Unknown error', duration: 4000 }) } }, enabled: true,
      })

      // Update send-message to use the real handler
      const sendBinding = km.getBinding('send-message')
      if (sendBinding) {
        km.register({ ...sendBinding, handler: () => { document.querySelector<HTMLTextAreaElement>('[data-send-input]')?.focus(); useNotificationsStore.getState().addNotification({ type: 'info', title: 'Enter to send', duration: 1500 }) } })
      }

      // Set contexts for the keybinding manager
      km.setContext('chatView', currentView === 'chat')
      km.setContext('inputFocus', false)
    } catch { /* keybindings not fully initialized */ }

    // Global keydown handler for keybinding manager
    const handler = (e: KeyboardEvent) => {
      try {
        const km = getKeybindingManager()
        if (km.handleKeyEvent(e)) {
          e.preventDefault()
          e.stopPropagation()
        }
      } catch { /* ignore */ }
    }
    window.addEventListener('keydown', handler)

    // Update chat view context
    let unsub: (() => void) | undefined
    try {
      const km = getKeybindingManager()
      unsub = useViewStore.subscribe((state, prev) => {
        if (state.currentView !== prev.currentView) {
          km.setContext('chatView', state.currentView === 'chat')
        }
      })
    } catch { /* ignore */ }

    try {
      const resolver = getConfigResolver()
      const settingsMgr = getSettingsManager()
      loadPersistedSettings(settingsMgr)
      applyConfigToSettings(settingsMgr, resolver)
    } catch {
      /* config files may not exist yet */
    }

    return () => {
      window.removeEventListener('keydown', handler)
      unsub?.()
    }
  }, [])

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    localStorage.setItem('opendesktop-onboarding', 'true')
  }

  if (isLoading) {
    return <ParticleLoader onComplete={() => setIsLoading(false)} />
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {showProjectSidebar && (
        <div className="flex-shrink-0">
          <ProjectSidebar onClose={() => setShowProjectSidebar(false)} />
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center flex-shrink-0 border-b border-zinc-800 bg-zinc-900/80">
          <button
            onClick={() => setShowProjectSidebar(!showProjectSidebar)}
            className={`p-2 hover:bg-zinc-800 transition-colors flex-shrink-0 ${showProjectSidebar ? 'text-zinc-200' : 'text-zinc-500'}`}
            title={showProjectSidebar ? 'Close Projects' : 'Open Projects'}
          >
            {showProjectSidebar ? <PanelLeftClose className="w-4 h-4" /> : <FolderTree className="w-4 h-4" />}
          </button>

          {/* View Navigation Tabs */}
          <nav className="flex items-center gap-0.5 px-2 flex-shrink-0">
            {VIEW_NAV_ITEMS.filter(i => i.id !== 'chat').map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => useViewStore.getState().navigate(id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors ${
                  currentView === id ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex-1 min-w-0">
            <SessionTabs />
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <ViewContainer view="chat">
            <ErrorBoundary key={`chat-${activeSessionId}`}>
              {layout === 'single' && <ChatInterface key={activeSessionId} />}
              {layout === 'split-h' && (
                <div className="flex h-full">
                  <div className="flex-1 border-r border-zinc-800 overflow-hidden">
                    <ChatInterface key={sessions[0]?.id || 'left'} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <ChatInterface key={sessions[1]?.id || 'right'} />
                  </div>
                </div>
              )}
              {layout === 'split-v' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 border-b border-zinc-800 overflow-hidden">
                    <ChatInterface key={sessions[0]?.id || 'top'} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <ChatInterface key={sessions[1]?.id || 'bottom'} />
                  </div>
                </div>
              )}
              {layout === 'grid' && (
                <div className="grid grid-cols-2 grid-rows-2 h-full">
                  {sessions.slice(0, 4).map((s) => (
                    <div key={s.id} className="border border-zinc-800 overflow-hidden">
                      <ChatInterface key={s.id} />
                    </div>
                  ))}
                </div>
              )}
            </ErrorBoundary>
          </ViewContainer>

          {VIEW_NAV_ITEMS.filter(i => i.id !== 'chat').map(({ id }) => (
            <ViewContainer key={id} view={id}>
              <ViewContent view={id} />
            </ViewContainer>
          ))}
        </div>
      </div>

      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <ToastContainer />
    </div>
  )
}

export default App
