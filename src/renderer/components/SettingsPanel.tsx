import { useState, useEffect } from 'react'
import { useChatStore } from '../store/chatStore'
import { useAppStateStore } from '../store/appStateStore'
import { getSettingsManager, applyConfigToSettings, persistSettings, BUILT_IN_SETTINGS } from '../services/SettingsManager'
import { getConfigResolver } from '../services/ConfigResolver'
import { exportAllData, downloadExport, readImportFile, importAllData } from '../services/ExportImport'
import { useNotificationsStore } from '../store/notificationsStore'
import { Settings2, Moon, Sun, Monitor, Download, Upload } from 'lucide-react'

export function SettingsPanel() {
  const { settings, updateSettings } = useChatStore()
  const appState = useAppStateStore()
  const [activeTab, setActiveTab] = useState('general')
  const [resolvedConfig, setResolvedConfig] = useState<Record<string, any>>({})

  useEffect(() => {
    try {
      const resolver = getConfigResolver()
      const mgr = getSettingsManager()
      applyConfigToSettings(mgr, resolver)
      setResolvedConfig(mgr.getAll())
    } catch { /* not ready */ }
  }, [])

  const handleTheme = (theme: 'light' | 'dark' | 'system') => {
    updateSettings({ theme })
    persistSettings(getSettingsManager())
  }

  const handleExport = () => {
    const data = exportAllData()
    downloadExport(data)
    useNotificationsStore.getState().addNotification({ type: 'success', title: 'Exported', message: 'All data exported successfully', duration: 3000 })
  }

  const handleImport = async () => {
    try {
      const json = await readImportFile()
      const result = importAllData(json)
      useNotificationsStore.getState().addNotification({
        type: result.success ? 'success' : 'error',
        title: result.success ? 'Imported' : 'Import failed',
        message: result.success ? 'Data imported successfully' : result.error,
        duration: 4000,
      })
    } catch { /* user cancelled */ }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
        <Settings2 className="w-4 h-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
        <span className="text-[10px] text-zinc-500 ml-auto">config resolved from {Object.keys(resolvedConfig).length} keys</span>
      </div>

      <div className="flex border-b border-zinc-800 px-2">
        {[
          { id: 'general', label: 'General' },
          { id: 'config', label: 'Config' },
          { id: 'data', label: 'Data' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id ? 'border-zinc-100 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === 'general' && (
          <>
            <section>
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Theme</h3>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'dark' as const, label: 'Dark', icon: Moon },
                  { value: 'light' as const, label: 'Light', icon: Sun },
                  { value: 'system' as const, label: 'System', icon: Monitor },
                ]).map((t) => (
                  <button
                    key={t.value}
                    onClick={() => handleTheme(t.value)}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm transition-colors ${
                      settings.theme === t.value ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Font Size</h3>
              <div className="grid grid-cols-3 gap-2">
                {(['small', 'medium', 'large'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateSettings({ fontSize: s })}
                    className={`py-2 rounded-lg text-sm transition-colors ${
                      settings.fontSize === s ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Send Shortcut</h3>
              <div className="grid grid-cols-2 gap-2">
                {(['enter', 'ctrl-enter'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateSettings({ sendShortcut: s })}
                    className={`py-2 rounded-lg text-sm transition-colors ${
                      settings.sendShortcut === s ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {s === 'ctrl-enter' ? 'Ctrl + Enter' : 'Enter'}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Output Style</h3>
              <div className="grid grid-cols-3 gap-2">
                {(['concise', 'detailed', 'verbose'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => { updateSettings({ outputStyle: s }); appState.setOutputStyle(s) }}
                    className={`py-2 rounded-lg text-sm transition-colors ${
                      settings.outputStyle === s ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'config' && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Resolved Configuration</h3>
            {Object.keys(BUILT_IN_SETTINGS).map((path) => {
              const schema = BUILT_IN_SETTINGS[path]
              const value = resolvedConfig[path]
              return (
                <div key={path} className="flex items-center justify-between px-3 py-2 rounded bg-zinc-800/30">
                  <div>
                    <div className="text-xs text-zinc-300 font-mono">{path}</div>
                    <div className="text-[10px] text-zinc-500">{schema.description}</div>
                  </div>
                  <div className="text-xs text-zinc-400 font-mono">
                    {value !== undefined ? JSON.stringify(value) : <span className="text-zinc-600">—</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'data' && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleExport} className="flex flex-col items-center gap-2 p-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
              <Download className="w-5 h-5 text-zinc-400" />
              <span className="text-sm text-zinc-200">Export All</span>
              <span className="text-xs text-zinc-500">Chats, providers, settings</span>
            </button>
            <button onClick={handleImport} className="flex flex-col items-center gap-2 p-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
              <Upload className="w-5 h-5 text-zinc-400" />
              <span className="text-sm text-zinc-200">Import</span>
              <span className="text-xs text-zinc-500">From .json</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
