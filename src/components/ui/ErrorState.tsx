import { Button } from './Button'

export interface ErrorStateProps {
  title?: string
  error: unknown
  onRetry?: () => void
}

export function ErrorState({ title = 'Could not load', error, onRetry }: ErrorStateProps) {
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="max-w-xs text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
