import { useState, useRef } from 'react'
import { X, RefreshCw, Code, Eye, Smartphone, Monitor } from 'lucide-react'

interface HtmlPreviewProps {
  onClose: () => void
}

export function HtmlPreview({ onClose }: HtmlPreviewProps) {
  const [htmlContent, setHtmlContent] = useState(`<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 { color: #1a1a1a; margin: 0 0 12px; }
    p { color: #666; line-height: 1.6; }
    .btn {
      display: inline-block;
      margin-top: 16px;
      padding: 10px 20px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello World</h1>
    <p>This is a preview of your HTML content. Edit the code on the left to see changes here.</p>
    <button class="btn">Click Me</button>
  </div>
</body>
</html>`)
  const [viewMode, setViewMode] = useState<'split' | 'preview' | 'code'>('split')
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = htmlContent
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-6xl max-h-[85vh] flex flex-col rounded-xl overflow-hidden border border-zinc-800" style={{ background: '#18181b' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-100">HTML Preview</h2>
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('split')}
                className={`px-2 py-1 rounded text-xs ${viewMode === 'split' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800'}`}
              >
                Split
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-2 py-1 rounded text-xs ${viewMode === 'preview' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800'}`}
              >
                Preview
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`px-2 py-1 rounded text-xs ${viewMode === 'code' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800'}`}
              >
                Code
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <button
                onClick={() => setDeviceMode('desktop')}
                className={`p-1 rounded ${deviceMode === 'desktop' ? 'bg-zinc-700' : 'hover:bg-zinc-800'}`}
              >
                <Monitor className="w-3.5 h-3.5 text-zinc-400" />
              </button>
              <button
                onClick={() => setDeviceMode('mobile')}
                className={`p-1 rounded ${deviceMode === 'mobile' ? 'bg-zinc-700' : 'hover:bg-zinc-800'}`}
              >
                <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </div>
            <button onClick={handleRefresh} className="p-1.5 hover:bg-zinc-800 rounded" title="Refresh">
              <RefreshCw className="w-4 h-4 text-zinc-400" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded">
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Code Editor */}
          {(viewMode === 'split' || viewMode === 'code') && (
            <div className={`${viewMode === 'split' ? 'w-1/2 border-r border-zinc-800' : 'w-full'} flex flex-col`}>
              <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/50">
                <Code className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-500">HTML</span>
              </div>
              <textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                className="flex-1 bg-zinc-900 text-zinc-200 font-mono text-sm p-4 resize-none focus:outline-none"
                spellCheck={false}
              />
            </div>
          )}

          {/* Preview */}
          {(viewMode === 'split' || viewMode === 'preview') && (
            <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} flex flex-col bg-white`}>
              <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-200 bg-zinc-100">
                <Eye className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-500">Preview</span>
              </div>
              <div className={`flex-1 flex ${deviceMode === 'mobile' ? 'justify-center items-center bg-zinc-100' : ''}`}>
                <iframe
                  ref={iframeRef}
                  srcDoc={htmlContent}
                  className={`w-full h-full ${deviceMode === 'mobile' ? 'max-w-[375px] border-x border-zinc-300' : ''}`}
                  sandbox="allow-scripts"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
