import { useState, useEffect } from 'react'
import { getLSPManager } from '../services/LSPIntegration'

export function LSPDiagnosticsIndicator() {
  const [errorCount, setErrorCount] = useState(0)
  const [warningCount, setWarningCount] = useState(0)
  const lsp = getLSPManager()
  const registry = lsp.getRegistry()

  useEffect(() => {
    const unsub = registry.onChange(() => {
      setErrorCount(registry.getErrorCount())
      setWarningCount(registry.getWarningCount())
    })
    return unsub
  }, [])

  if (errorCount === 0 && warningCount === 0) return null

  return (
    <span className="flex items-center gap-1.5 text-[10px]">
      {errorCount > 0 && <span className="text-red-400">{errorCount}E</span>}
      {warningCount > 0 && <span className="text-amber-400">{warningCount}W</span>}
    </span>
  )
}
