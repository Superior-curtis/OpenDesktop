import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, FileCode, FileJson, FileImage, FileText, FileType, RefreshCw } from 'lucide-react'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  size?: number
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (!ext) return File
  switch (ext) {
    case 'ts': case 'tsx': case 'js': case 'jsx': return FileCode
    case 'json': case 'jsonc': return FileJson
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'webp': return FileImage
    case 'md': case 'mdx': case 'txt': return FileText
    case 'css': case 'scss': case 'less': case 'html': return FileType
    default: return File
  }
}

function TreeNode({ node, depth = 0, onSelect }: { node: FileNode; depth?: number; onSelect?: (path: string) => void }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const [children, setChildren] = useState<FileNode[]>(node.children ?? [])
  const [loading, setLoading] = useState(false)
  const isDir = node.type === 'directory'
  const Icon = isDir ? (expanded ? FolderOpen : Folder) : getFileIcon(node.name)

  const loadChildren = useCallback(async () => {
    if (!isDir || children.length > 0) return
    setLoading(true)
    try {
      const prefix = window.location.pathname.replace(/\/[^/]*$/, '')
      const basePath = node.path.startsWith('/') ? node.path : `${prefix}/${node.path}`

      let entries: { name: string; type: 'file' | 'directory' }[] = []
      try {
        if (window.api?.glob) {
          const files = await window.api.glob(`${basePath}/*`)
          entries = files.map((f: string) => {
            const relative = f.replace(basePath, '').replace(/^[/\\]/, '')
            const isDirType = f.endsWith('/')
            return { name: relative, type: isDirType ? 'directory' : 'file' }
          })
        }
      } catch { /* fallback to static example */ }

      if (entries.length === 0) {
        entries = [
          { name: 'src', type: 'directory' },
          { name: 'package.json', type: 'file' },
          { name: 'tsconfig.json', type: 'file' },
        ]
      }

      setChildren(entries.map((e) => ({
        name: e.name,
        path: `${node.path}/${e.name}`.replace(/\/+/g, '/'),
        type: e.type,
      })))
    } catch { /* ignore */ }
    setLoading(false)
  }, [node.path, isDir, children.length])

  const toggleExpand = async () => {
    if (!expanded && isDir && children.length === 0) {
      await loadChildren()
    }
    setExpanded(!expanded)
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer hover:bg-zinc-800/50 transition-colors text-xs ${depth === 0 ? 'text-zinc-200' : 'text-zinc-400'}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => isDir ? toggleExpand() : onSelect?.(node.path)}
      >
        {isDir ? (
          <span className="flex-shrink-0 w-3.5 flex justify-center">
            {loading ? (
              <RefreshCw className="w-3 h-3 animate-spin text-zinc-600" />
            ) : expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </span>
        ) : (
          <span className="w-3.5" />
        )}
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isDir ? 'text-zinc-400' : 'text-zinc-500'}`} />
        <span className="truncate flex-1">{node.name}</span>
        {node.size !== undefined && (
          <span className="text-[10px] text-zinc-700">{node.size}B</span>
        )}
      </div>
      {isDir && expanded && (
        <div>
          {children.length === 0 && !loading && (
            <div className="text-[10px] text-zinc-700 italic pl-8 py-1">empty directory</div>
          )}
          {children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileExplorer({ onFileSelect }: { onFileSelect?: (path: string) => void }) {
  const [rootPath, setRootPath] = useState('')
  const [roots, setRoots] = useState<FileNode[]>([])

  useEffect(() => {
    try {
      const path = window.location.pathname.replace(/\/[^/]*$/, '') || '/'
      setRootPath(path)
      setRoots([
        { name: path.split('/').filter(Boolean).pop() || 'project', path, type: 'directory', children: [] },
      ])
    } catch {
      setRoots([
        { name: 'project', path: '/', type: 'directory', children: [] },
      ])
    }
  }, [])

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
        <FolderOpen className="w-4 h-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-100">Files</h2>
        <span className="text-[10px] text-zinc-600 ml-auto font-mono truncate max-w-[120px]">{rootPath}</span>
        <button
          onClick={() => setRoots([{ ...roots[0] }])}
          className="p-1 hover:bg-zinc-800 rounded"
          title="Refresh"
        >
          <RefreshCw className="w-3 h-3 text-zinc-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {roots.map((root) => (
          <TreeNode key={root.path} node={root} onSelect={onFileSelect} />
        ))}
      </div>
    </div>
  )
}
