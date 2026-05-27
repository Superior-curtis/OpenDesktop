import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onReset?.()
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex items-center justify-center h-full bg-zinc-950 p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-100">Something went wrong</h2>
            <p className="text-xs text-zinc-500 font-mono bg-zinc-900 rounded p-3 text-left max-h-32 overflow-y-auto">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-100 text-xs text-zinc-900 hover:bg-white transition-colors"
              >
                <Home className="w-3 h-3" /> Reload
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
