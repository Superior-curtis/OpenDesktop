import { useState, useRef } from 'react'
import { X, Save, FileText, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react'
import { FileNode } from '../types/workspace'

interface FileEditorProps {
  onClose: () => void
}

const MOCK_FILES: FileNode[] = [
  {
    name: 'src',
    path: '/src',
    type: 'directory',
    children: [
      { name: 'App.tsx', path: '/src/App.tsx', type: 'file', content: 'export function App() {\n  return <div>Hello</div>\n}' },
      { name: 'index.tsx', path: '/src/index.tsx', type: 'file', content: 'import { App } from "./App"\n// Entry point' },
      {
        name: 'components',
        path: '/src/components',
        type: 'directory',
        children: [
          { name: 'Header.tsx', path: '/src/components/Header.tsx', type: 'file', content: 'export function Header() {\n  return <header>Header</header>\n}' },
        ],
      },
    ],
  },
  { name: 'package.json', path: '/package.json', type: 'file', content: '{\n  "name": "my-app",\n  "version": "1.0.0"\n}' },
  { name: 'README.md', path: '/README.md', type: 'file', content: '# My App\n\nDescription here.' },
]

export function FileEditor({ onClose }: FileEditorProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['/src']))
  const [openFiles, setOpenFiles] = useState<Map<string, string>>(new Map())
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const openFile = (node: FileNode) => {
    if (node.type !== 'file' || !node.content) return
    setOpenFiles((prev) => new Map(prev).set(node.path, node.name))
    setActiveFile(node.path)
    setFileContent(node.content)
    setHasChanges(false)
  }

  const closeFile = (path: string) => {
    setOpenFiles((prev) => {
      const next = new Map(prev)
      next.delete(path)
      return next
    })
    if (activeFile === path) {
      const remaining = Array.from(openFiles.keys()).filter((p) => p !== path)
      setActiveFile(remaining[0] || null)
      setFileContent('')
    }
  }

  const handleSave = async () => {
    if (!activeFile) return
    // In production, this would write to disk via Electron IPC
    setHasChanges(false)
  }

  const handleContentChange = (content: string) => {
    setFileContent(content)
    setHasChanges(true)
  }

  const renderTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.path}>
        <button
          onClick={() => node.type === 'directory' ? toggleDir(node.path) : openFile(node)}
          className="flex items-center gap-1 w-full px-2 py-1 text-left text-xs hover:bg-zinc-800 rounded transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {node.type === 'directory' ? (
            <>
              {expandedDirs.has(node.path) ? (
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              ) : (
                <ChevronRight className="w-3 h-3 text-zinc-500" />
              )}
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            </>
          ) : (
            <>
              <span className="w-3" />
              <FileText className="w-3.5 h-3.5 text-zinc-500" />
            </>
          )}
          <span className="text-zinc-300 truncate">{node.name}</span>
        </button>
        {node.type === 'directory' && node.children && expandedDirs.has(node.path) && (
          <div>{renderTree(node.children, depth + 1)}</div>
        )}
      </div>
    ))
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-4xl max-h-[80vh] flex flex-col rounded-xl overflow-hidden border border-zinc-800" style={{ background: '#18181b' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100">File Editor</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* File Tree */}
          <div className="w-52 border-r border-zinc-800 overflow-y-auto p-1">
            {renderTree(MOCK_FILES)}
          </div>

          {/* Editor Area */}
          <div className="flex-1 flex flex-col">
            {/* Open File Tabs */}
            {openFiles.size > 0 && (
              <div className="flex items-center gap-0.5 px-2 py-1 border-b border-zinc-800 bg-zinc-900/50 overflow-x-auto">
                {Array.from(openFiles.entries()).map(([path, name]) => (
                  <button
                    key={path}
                    onClick={() => {
                      setActiveFile(path)
                      // In production, load file content
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap ${
                      path === activeFile ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800'
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    {name}
                    {hasChanges && path === activeFile && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                    <span
                      onClick={(e) => { e.stopPropagation(); closeFile(path) }}
                      className="p-0.5 rounded hover:bg-zinc-600 ml-1"
                    >
                      <X className="w-2.5 h-2.5" />
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Editor */}
            <div className="flex-1 flex flex-col">
              {activeFile ? (
                <>
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/30">
                    <span className="text-xs text-zinc-500">{activeFile}</span>
                    <button
                      onClick={handleSave}
                      disabled={!hasChanges}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-3 h-3" />
                      Save
                    </button>
                  </div>
                  <textarea
                    ref={editorRef}
                    value={fileContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    className="flex-1 bg-zinc-900 text-zinc-200 font-mono text-sm p-4 resize-none focus:outline-none"
                    spellCheck={false}
                  />
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
                  Select a file to edit
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
