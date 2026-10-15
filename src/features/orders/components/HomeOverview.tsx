import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Skeleton } from '../../../components/ui'
import { addMoney, formatINR } from '../../../lib/money'
import { usePendingPayments } from '../../analytics/hooks/useAnalytics'
import { useOrders } from '../hooks/useOrders'

/**
 * Where the work stands, at a glance. Each card is a link to the screen where that work is done:
 *  - To prepare: the number of New orders; opens Home's "To prepare" view (items added up per product)
 *  - To deliver: the number of Ready orders; opens Delivery
 *  - Unpaid: money still owed on DELIVERED orders not marked paid (B5: Outstanding); opens Pending payments.
 *    A Ready order is not in it until it is delivered.
 */
export function HomeOverview() {
  const fresh = useOrders('new', '')
  const ready = useOrders('ready', '')
  const pending = usePendingPayments()
  const unpaid = pending.data ? addMoney(...pending.data.map((p) => p.total)) : undefined

  return (
    <div className="grid grid-cols-3 gap-2">
      <Card
        tone="bg-lavender text-text"
        label="To prepare"
        value={cardValue(fresh.isError, fresh.data?.length)}
        to="/?view=prep"
      />
      <Card
        tone="bg-mint text-text"
        label="To deliver"
        value={cardValue(ready.isError, ready.data?.length)}
        to="/delivery"
      />
      <Card
        tone="bg-peach text-text"
        label="Unpaid"
        value={cardValue(pending.isError, unpaid === undefined ? undefined : formatINR(unpaid))}
        to="/pending"
      />
    </div>
  )
}

/** A failed query shows a dash (the card still opens its screen, which has the retry), never a stuck skeleton. */
function cardValue(failed: boolean, value: ReactNode | undefined): ReactNode | undefined {
  return failed ? '—' : value
}

interface CardProps {
  tone: string
  label: string
  value: ReactNode | undefined
  to: string
}

function Card({ tone, label, value, to }: CardProps) {
  return (
    <Link
      to={to}
      replace={to.startsWith('/?')}
      className={`flex min-h-20 min-w-0 flex-col justify-between rounded-2xl p-3 text-left ${tone}`}
    >
      <span className="text-sm font-medium text-text/70">{label}</span>
      {value === undefined ? (
        <Skeleton className="mt-1 h-7 w-12" />
      ) : (
        <span className="font-display block truncate text-2xl tabular-nums">{value}</span>
      )}
    </Link>
  )
}
