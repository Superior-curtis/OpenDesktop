import { useState, useRef } from 'react'
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react'

interface PdfPreviewProps {
  onClose: () => void
}

export function PdfPreview({ onClose }: PdfPreviewProps) {
  const [zoom, setZoom] = useState(100)
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = 5
  const [dragOver, setDragOver] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 200))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 50))
  const handlePrevPage = () => setCurrentPage((p) => Math.max(p - 1, 1))
  const handleNextPage = () => setCurrentPage((p) => Math.min(p + 1, totalPages))

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') {
      setPdfUrl(URL.createObjectURL(file))
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setPdfUrl(URL.createObjectURL(file))
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden border border-zinc-800" style={{ background: '#18181b' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100">PDF Preview</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleZoomOut} className="p-1.5 hover:bg-zinc-800 rounded">
              <ZoomOut className="w-4 h-4 text-zinc-400" />
            </button>
            <span className="text-xs text-zinc-400 w-12 text-center">{zoom}%</span>
            <button onClick={handleZoomIn} className="p-1.5 hover:bg-zinc-800 rounded">
              <ZoomIn className="w-4 h-4 text-zinc-400" />
            </button>
            <div className="w-px h-4 bg-zinc-700" />
            <button onClick={handlePrevPage} disabled={currentPage === 1} className="p-1.5 hover:bg-zinc-800 rounded disabled:opacity-50">
              <ChevronLeft className="w-4 h-4 text-zinc-400" />
            </button>
            <span className="text-xs text-zinc-400">{currentPage} / {totalPages}</span>
            <button onClick={handleNextPage} disabled={currentPage === totalPages} className="p-1.5 hover:bg-zinc-800 rounded disabled:opacity-50">
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
            <div className="w-px h-4 bg-zinc-700" />
            <button className="p-1.5 hover:bg-zinc-800 rounded" title="Download">
              <Download className="w-4 h-4 text-zinc-400" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded">
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-zinc-900">
          {pdfUrl ? (
            <div className="flex justify-center p-4">
              <iframe
                src={pdfUrl}
                className="border border-zinc-700 rounded shadow-lg"
                style={{ width: `${zoom * 8}px`, height: `${zoom * 11}px` }}
              />
            </div>
          ) : (
            <div
              className={`flex flex-col items-center justify-center h-full p-8 border-2 border-dashed rounded-lg m-8 transition-colors ${
                dragOver ? 'border-zinc-500 bg-zinc-800/50' : 'border-zinc-700'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
            >
              <FileText className="w-12 h-12 text-zinc-600 mb-4" />
              <p className="text-zinc-400 text-sm mb-2">Drop a PDF file here</p>
              <p className="text-zinc-600 text-xs mb-4">or</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700"
              >
                Browse Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
