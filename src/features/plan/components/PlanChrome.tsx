import { Link, useLocation } from 'react-router-dom'
import { EmptyState } from '../../../components/ui'
import { usePlan } from '../hooks/usePlan'
import { planNotice } from '../schemas'

const TONE = {
  danger: 'bg-danger-soft text-danger-ink',
  warning: 'bg-ochre text-text',
}

/** A strip above every page when the plan needs attention (ended, ending soon, near a limit). */
export function LimitBanner() {
  const plan = usePlan()
  const { pathname } = useLocation()
  const notice = plan.data ? planNotice(plan.data, new Date()) : null
  if (!notice || pathname === '/plan') return null
  return (
    <Link
      to="/plan"
      role="status"
      className={`block px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 text-center text-sm font-medium ${TONE[notice.tone]}`}
    >
      {notice.text} <span className="underline underline-offset-4">See plan</span>
    </Link>
  )
}

/** Pages a locked shop may still open: the plan itself, sign-out (More) and the terms. */
const OPEN_WHEN_LOCKED = ['/plan', '/more', '/terms', '/admin']

/** True when the shop is locked and this page must show the wall instead of its content. */
export function useLockedWall(): boolean {
  const plan = usePlan()
  const { pathname } = useLocation()
  return plan.data?.status === 'locked' && !OPEN_WHEN_LOCKED.includes(pathname)
}

export function LockedWall() {
  return (
    <EmptyState
      title="Your plan has ended"
      description="Your orders and products are safe. Renew to open the shop again."
      action={
        <Link to="/plan" className="font-medium underline underline-offset-4">
          See plans
        </Link>
      }
    />
  )
}
