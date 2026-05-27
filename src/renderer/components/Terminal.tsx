import { useState, useRef, useEffect } from 'react'
import { X, Terminal as TerminalIcon, ChevronUp, Maximize2, Minimize2, Play, Square } from 'lucide-react'

interface TerminalPanelProps {
  onClose: () => void
}

interface CommandEntry {
  id: string
  command: string
  output: string
  error: string
  timestamp: number
  status: 'running' | 'completed' | 'failed'
}

export function TerminalPanel({ onClose }: TerminalPanelProps) {
  const [shell, setShell] = useState<'powershell' | 'cmd'>('powershell')
  const [input, setInput] = useState('')
  const [commands, setCommands] = useState<CommandEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [output, setOutput] = useState('')
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    terminalRef.current?.scrollTo(0, terminalRef.current.scrollHeight)
  }, [commands, output])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim() || isRunning) return

    const entry: CommandEntry = {
      id: crypto.randomUUID(),
      command: cmd,
      output: '',
      error: '',
      timestamp: Date.now(),
      status: 'running',
    }

    setCommands((prev) => [...prev, entry])
    setIsRunning(true)
    setOutput('')

    try {
      const result = await window.electron.terminal.execute(cmd, shell)

      setCommands((prev) =>
        prev.map((c) =>
          c.id === entry.id
            ? {
                ...c,
                output: result.stdout || '',
                error: result.stderr || '',
                status: result.success ? 'completed' : 'failed',
              }
            : c
        )
      )
      setOutput(result.stdout || result.stderr || '')
    } catch (error) {
      setCommands((prev) =>
        prev.map((c) =>
          c.id === entry.id
            ? {
                ...c,
                error: error instanceof Error ? error.message : 'Unknown error',
                status: 'failed',
              }
            : c
        )
      )
    } finally {
      setIsRunning(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      executeCommand(input)
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const lastCmd = commands.filter((c) => c.command).pop()
      if (lastCmd) setInput(lastCmd.command)
    }
  }

  const clearTerminal = () => {
    setCommands([])
    setOutput('')
  }

  const stopExecution = () => {
    setIsRunning(false)
    window.electron.terminal.kill()
  }

  return (
    <div
      className={`fixed bottom-4 right-4 bg-[#1a1a1f] border border-border rounded-xl shadow-2xl z-50 overflow-hidden transition-all duration-300 ${
        isMaximized ? 'inset-4' : isMinimized ? 'w-80' : 'w-[600px] max-h-[500px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#252530] border-b border-border">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium">
            {shell === 'powershell' ? 'PowerShell' : 'Command Prompt'}
          </span>
          {isRunning && (
            <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded-full animate-pulse">
              Running
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShell(shell === 'powershell' ? 'cmd' : 'powershell')}
            className="px-2 py-1 text-xs bg-secondary/50 hover:bg-secondary rounded transition-colors"
          >
            {shell === 'powershell' ? 'PS' : 'CMD'}
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-secondary rounded transition-colors"
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 hover:bg-secondary rounded transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={clearTerminal}
            className="p-1.5 hover:bg-secondary rounded transition-colors"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-destructive/20 hover:text-destructive rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Output */}
          <div
            ref={terminalRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-2 max-h-[350px]"
          >
            {commands.length === 0 && (
              <div className="text-muted-foreground text-center py-8">
                <TerminalIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Type a command and press Enter</p>
                <p className="text-xs mt-1">Supports PowerShell and CMD</p>
              </div>
            )}

            {commands.map((entry) => (
              <div key={entry.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500">❯</span>
                  <span className="text-foreground">{entry.command}</span>
                  {entry.status === 'running' && (
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  )}
                </div>
                {entry.output && (
                  <pre className="text-muted-foreground whitespace-pre-wrap pl-6 text-xs">
                    {entry.output}
                  </pre>
                )}
                {entry.error && (
                  <pre className="text-destructive whitespace-pre-wrap pl-6 text-xs">
                    {entry.error}
                  </pre>
                )}
              </div>
            ))}

            {isRunning && (
              <div className="flex items-center gap-2 text-amber-500">
                <span className="animate-pulse">⠋</span>
                <span className="text-xs">Executing...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 bg-[#252530] border-t border-border">
            <span className="text-emerald-500 font-mono text-sm">❯</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Enter ${shell === 'powershell' ? 'PowerShell' : 'CMD'} command...`}
              className="flex-1 bg-transparent font-mono text-sm focus:outline-none placeholder:text-muted-foreground/50"
              disabled={isRunning}
            />
            {isRunning ? (
              <button
                type="button"
                onClick={stopExecution}
                className="px-3 py-1.5 bg-destructive/20 text-destructive rounded-md text-xs hover:bg-destructive/30 transition-colors flex items-center gap-1"
              >
                <Square className="w-3 h-3" />
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="px-3 py-1.5 bg-emerald-500/20 text-emerald-500 rounded-md text-xs hover:bg-emerald-500/30 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Play className="w-3 h-3" />
                Run
              </button>
            )}
          </form>
        </>
      )}
    </div>
  )
}
