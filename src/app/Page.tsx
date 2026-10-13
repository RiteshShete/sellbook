import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export interface PageProps {
  title: string
  /** Small line under the title (e.g. "Order #15 · 10 Oct 2026"). */
  subtitle?: string
  /** Let a long title (a customer name) wrap to two lines instead of cutting it off with "…". */
  wrapTitle?: boolean
  /**
   * Inner pages: shows a back button. Goes back in history when there is somewhere to go back
   * to, else to this path (an installed PWA has no browser back button, and a shared link may be
   * the first page opened).
   */
  back?: string
  /** Primary action slot, shown at the right of the sticky header. */
  action?: ReactNode
  children: ReactNode
}

export function Page({ title, subtitle, wrapTitle = false, back, action, children }: PageProps) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1 px-4">
          {back !== undefined && <BackButton fallback={back} />}
          <div className="min-w-0 flex-1 py-1">
            <h1
              className={`font-display text-2xl ${wrapTitle ? 'line-clamp-2 leading-snug break-words' : 'truncate'}`}
            >
              {title}
            </h1>
            {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl min-w-0 px-4 py-4">{children}</div>
    </>
  )
}

function BackButton({ fallback }: { fallback: string }) {
  const navigate = useNavigate()
  // React Router marks the first entry of this tab's session with key 'default'.
  const canGoBack = useLocation().key !== 'default'
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => void (canGoBack ? navigate(-1) : navigate(fallback, { replace: true }))}
      className="-ml-3 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl active:bg-surface-2"
    >
      <ChevronLeft className="h-6 w-6" />
    </button>
  )
}
