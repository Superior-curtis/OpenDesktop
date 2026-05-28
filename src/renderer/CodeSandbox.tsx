import { useState, useRef } from 'react'
import { Play, Code, X, Maximize2 } from 'lucide-react'

interface Props { onClose: () => void }

export function CodeSandbox({ onClose }: Props) {
  const [html, setHtml] = useState('<!-- AI-generated code appears here -->\n<h1 style="color: #6366f1; font-family: sans-serif; text-align: center; margin-top: 40px;">\n  Hello from OpenDesktop! 🚀\n</h1>\n<p style="text-align: center; color: #888;">Ask the AI to build something</p>')
  const [css, setCss] = useState('')
  const [js, setJs] = useState('')
  const [activeTab, setActiveTab] = useState<'html'|'css'|'js'>('html')
  const [fullscreen, setFullscreen] = useState(false)
  const previewRef = useRef<HTMLIFrameElement>(null)

  const runCode = () => {
    const doc = `
<!DOCTYPE html><html><head><style>body{margin:0;background:#111;color:#eee}${css}</style></head>
<body>${html}<script>${js}<\/script></body></html>`
    if (previewRef.current) {
      previewRef.current.srcdoc = doc
    }
  }

  return (
    <div className={`fixed z-50 bg-[#1a1a1a] border border-zinc-800 shadow-2xl ${
      fullscreen ? 'inset-4 rounded-xl' : 'inset-x-4 bottom-20 top-20 rounded-xl'
    } flex flex-col`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 flex-shrink-0">
        <Code className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-medium text-zinc-300">Code Sandbox</span>
        <span className="text-xs text-zinc-600">— AI writes code, see it live</span>
        <div className="flex-1" />
        <button onClick={runCode} className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/30 transition-colors">
          <Play className="w-3 h-3" /> Run
        </button>
        <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500"><X className="w-3.5 h-3.5" /></button>
      </div>

      {/* Body: editor + preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className="w-1/2 flex flex-col border-r border-zinc-800">
          <div className="flex gap-1 px-3 py-1.5 border-b border-zinc-800">
            {(['html', 'css', 'js'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-3 py-1 rounded text-xs uppercase tracking-wider transition-colors ${
                  activeTab === t ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
                }`}>{t}</button>
            ))}
          </div>
          <textarea
            value={activeTab === 'html' ? html : activeTab === 'css' ? css : js}
            onChange={e => {
              if (activeTab === 'html') setHtml(e.target.value)
              else if (activeTab === 'css') setCss(e.target.value)
              else setJs(e.target.value)
            }}
            className="flex-1 bg-transparent text-sm text-zinc-300 font-mono p-4 resize-none outline-none"
            spellCheck={false}
            placeholder={activeTab === 'html' ? '<!-- HTML here -->' : activeTab === 'css' ? '/* CSS here */' : '// JavaScript here'}
          />
        </div>

        {/* Preview */}
        <div className="w-1/2 bg-white">
          <iframe ref={previewRef} className="w-full h-full border-0" sandbox="allow-scripts" title="Preview" />
        </div>
      </div>
    </div>
  )
}
