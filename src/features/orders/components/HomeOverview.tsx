import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Skeleton } from '../../../components/ui'
import { addMoney, formatINR } from '../../../lib/money'
import { usePendingPayments } from '../../analytics/hooks/useAnalytics'
import { useOrders } from '../hooks/useOrders'

/**
 * Where the work stands, at a glance: what to make, what to deliver, what is still unpaid. Each
 * card leads to the screen where that work is done.
 */
export function HomeOverview({ onShowPrep }: { onShowPrep: () => void }) {
  const fresh = useOrders('new', '')
  const ready = useOrders('ready', '')
  const pending = usePendingPayments()
  const unpaid = pending.data ? addMoney(...pending.data.map((p) => p.total)) : undefined

  return (
    <div className="grid grid-cols-3 gap-2">
      <Card
        tone="bg-lavender text-text"
        label="To make"
        value={fresh.data?.length}
        onClick={onShowPrep}
      />
      <Card tone="bg-mint text-text" label="To deliver" value={ready.data?.length} to="/delivery" />
      <Card
        tone="bg-peach text-text"
        label="Unpaid"
        value={unpaid === undefined ? undefined : formatINR(unpaid)}
        to="/pending"
      />
    </div>
  )
}

interface CardProps {
  tone: string
  label: string
  value: ReactNode | undefined
  to?: string
  onClick?: () => void
}

function Card({ tone, label, value, to, onClick }: CardProps) {
  const body = (
    <>
      <span className="flex items-center justify-between text-sm text-text/70">
        {label} <ChevronRight className="h-4 w-4" />
      </span>
      {value === undefined ? (
        <Skeleton className="mt-1 h-7 w-12" />
      ) : (
        <span className="font-display block truncate text-2xl tabular-nums">{value}</span>
      )}
    </>
  )
  const className = `flex min-h-20 min-w-0 flex-col justify-between rounded-2xl p-3 text-left ${tone}`
  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  )
}
