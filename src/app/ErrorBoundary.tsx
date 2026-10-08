import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '../components/ui'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/** Top-level safety net: a render crash shows a readable screen instead of a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <ErrorScreen message={this.state.error.message} />
  }
}

export function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="break-words text-muted">{message}</p>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </div>
  )
}
