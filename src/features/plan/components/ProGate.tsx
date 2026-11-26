import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../../../app/Page'
import { EmptyState, Skeleton } from '../../../components/ui'
import { usePro } from '../hooks/usePlan'

export interface ProGateProps {
  /** Name shown in the upgrade message, e.g. "Order history". */
  feature: string
  /** A whole routed page is gated: give the message a header with a back button. */
  page?: boolean
  children: ReactNode
}

/** Shows `children` on Pro (and the trial); otherwise an upgrade message. The server enforces the same rule. */
export function ProGate({ feature, page = false, children }: ProGateProps) {
  const pro = usePro()
  if (pro) return <>{children}</>
  const body =
    pro === null ? (
      <div role="status" aria-label="Loading">
        <Skeleton className="h-24 w-full" />
      </div>
    ) : (
      <EmptyState
        title={`${feature} is a Pro feature`}
        description="Upgrade to Pro to use it. Your data stays as it is."
        action={
          <Link to="/plan" className="font-medium underline underline-offset-4">
            See plans
          </Link>
        }
      />
    )
  return page ? (
    <Page title={feature} back="/">
      {body}
    </Page>
  ) : (
    body
  )
}
