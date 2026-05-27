import { useState } from 'react'
import { X, ChevronRight, ChevronDown, FileText, Copy, Check } from 'lucide-react'
import { DiffEntry } from '../types/workspace'

interface DiffViewerProps {
  onClose: () => void
}

const MOCK_DIFFS: DiffEntry[] = [
  {
    file: 'src/App.tsx',
    oldContent: `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <h1>Counter: {count}</h1>
      <button onClick={() => setCount(c => c + 1)}>
        Increment
      </button>
    </div>
  )
}

export default App`,
    newContent: `import { useState, useCallback } from 'react'

interface AppProps {
  initialCount?: number
}

function App({ initialCount = 0 }: AppProps) {
  const [count, setCount] = useState(initialCount)

  const increment = useCallback(() => {
    setCount(c => c + 1)
  }, [])

  return (
    <div className="app">
      <h1>Counter: {count}</h1>
      <button onClick={increment}>
        Increment
      </button>
    </div>
  )
}

export default App`,
    status: 'modified',
  },
  {
    file: 'src/utils/helpers.ts',
    oldContent: '',
    newContent: `export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}`,
    status: 'added',
  },
  {
    file: 'src/old-component.tsx',
    oldContent: `// Deprecated component
export function OldComponent() {
  return <div>This is no longer used</div>
}`,
    newContent: '',
    status: 'deleted',
  },
]

function DiffLine({ line, type }: { line: string; type: 'add' | 'remove' | 'context' }) {
  const bgColor = type === 'add' ? 'bg-emerald-900/30' : type === 'remove' ? 'bg-red-900/30' : ''
  const textColor = type === 'add' ? 'text-emerald-400' : type === 'remove' ? 'text-red-400' : 'text-zinc-400'
  const prefix = type === 'add' ? '+' : type === 'remove' ? '-' : ' '

  return (
    <div className={`flex ${bgColor} hover:bg-zinc-800/50`}>
      <span className="text-zinc-600 text-xs w-10 text-right pr-3 select-none flex-shrink-0">{prefix}</span>
      <span className={`${textColor} text-xs font-mono whitespace-pre`}>{line || ' '}</span>
    </div>
  )
}

function computeDiffLines(oldContent: string, newContent: string) {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const result: { line: string; type: 'add' | 'remove' | 'context' }[] = []

  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i]
    const newLine = newLines[i]

    if (oldLine === newLine) {
      result.push({ line: oldLine || '', type: 'context' })
    } else {
      if (oldLine !== undefined) result.push({ line: oldLine, type: 'remove' })
      if (newLine !== undefined) result.push({ line: newLine, type: 'add' })
    }
  }

  return result
}

export function DiffViewer({ onClose }: DiffViewerProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set(['src/App.tsx']))
  const [copied, setCopied] = useState(false)

  const toggleFile = (file: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(file)) next.delete(file)
      else next.add(file)
      return next
    })
  }

  const handleCopyPatch = () => {
    const patch = MOCK_DIFFS.map((d) => {
      const status = d.status === 'added' ? '+++' : d.status === 'deleted' ? '---' : '---'
      return `${status} ${d.file}\n${d.newContent || d.oldContent}`
    }).join('\n\n')
    navigator.clipboard.writeText(patch)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const stats = {
    added: MOCK_DIFFS.filter((d) => d.status === 'added').length,
    modified: MOCK_DIFFS.filter((d) => d.status === 'modified').length,
    deleted: MOCK_DIFFS.filter((d) => d.status === 'deleted').length,
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl overflow-hidden border border-zinc-800" style={{ background: '#18181b' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Changes</h2>
            <div className="flex gap-2 text-xs">
              <span className="text-emerald-400">+{stats.added} added</span>
              <span className="text-amber-400">~{stats.modified} modified</span>
              <span className="text-red-400">-{stats.deleted} deleted</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyPatch}
              className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy Patch'}
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded">
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto">
          {MOCK_DIFFS.map((diff) => {
            const isExpanded = expandedFiles.has(diff.file)
            const statusColor = diff.status === 'added' ? 'text-emerald-400' : diff.status === 'deleted' ? 'text-red-400' : 'text-amber-400'
            const statusLabel = diff.status === 'added' ? 'A' : diff.status === 'deleted' ? 'D' : 'M'
            const diffLines = computeDiffLines(diff.oldContent, diff.newContent)

            return (
              <div key={diff.file} className="border-b border-zinc-800">
                <button
                  onClick={() => toggleFile(diff.file)}
                  className="flex items-center gap-2 w-full px-4 py-2 hover:bg-zinc-800/50 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
                  <FileText className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-sm text-zinc-300 flex-1 text-left">{diff.file}</span>
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${statusColor} bg-zinc-800`}>{statusLabel}</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-800 font-mono">
                    <div className="flex border-b border-zinc-800 bg-zinc-900/50">
                      <div className="flex-1 px-4 py-1 text-xs text-zinc-500">
                        {diff.status === 'deleted' ? diff.file : `${diff.file} (new)`}
                      </div>
                    </div>
                    {diffLines.map((dl, i) => (
                      <DiffLine key={i} line={dl.line} type={dl.type} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
