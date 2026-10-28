import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface State {
  error: Error | null
}

/** Keeps one broken screen from taking the whole app down. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ganga] Screen crashed', error, info.componentStack)
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-3xl bg-surface p-10 text-center shadow-panel">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200"><AlertTriangle className="h-6 w-6" /></span>
        <h2 className="text-lg font-bold text-navy-900">This screen hit a problem</h2>
        <p className="text-sm text-silver-600">{this.state.error.message}</p>
        <Button icon={<RefreshCw className="h-4 w-4" />} onClick={() => this.setState({ error: null })}>Try again</Button>
      </div>
    )
  }
}
