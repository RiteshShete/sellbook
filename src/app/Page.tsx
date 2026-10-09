import type { ReactNode } from 'react'

export interface PageProps {
  title: string
  /** Primary action slot, shown at the right of the sticky header. */
  action?: ReactNode
  children: ReactNode
}

export function Page({ title, action, children }: PageProps) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center justify-between gap-3 px-4">
          <h1 className="font-display min-w-0 truncate text-2xl">{title}</h1>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl min-w-0 px-4 py-4">{children}</div>
    </>
  )
}
