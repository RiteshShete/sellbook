import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="max-w-xs text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
