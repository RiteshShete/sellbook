import { Link } from 'react-router-dom'
import { ErrorState } from '../../../components/ui'
import { formatINR } from '../../../lib/money'
import { actionReasons, type ActionReason } from '../customerOrders'
import { useNeedsAction } from '../hooks/useCustomerOrders'
import { CustomerOrderActions } from './CustomerOrderActions'

const WHY: Record<ActionReason, string> = {
  confirm: 'Waiting for you to confirm',
  verify: 'Check the payment',
  refund: 'Refund needed',
}

/** The top of Home: customer orders that need the shop. Nothing is shown when there are none. */
export function NeedsActionList() {
  const needs = useNeedsAction()
  if (needs.isError) return <ErrorState error={needs.error} onRetry={() => void needs.refetch()} />
  const orders = needs.data ?? []
  if (orders.length === 0) return null
  return (
    <section aria-label="Needs your action" className="flex flex-col gap-3">
      <h2 className="font-display text-xl">Needs your action ({orders.length})</h2>
      <ul className="flex flex-col gap-3">
        {orders.map((o) => (
          <li key={o.id} className="flex flex-col gap-3 rounded-2xl border border-border-strong bg-surface p-4" data-testid="needs-action-card">
            <Link to={`/orders/${o.id}`} className="flex flex-col gap-1">
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-lg font-semibold"><span className="text-base font-medium text-muted">#{o.order_no}</span> {o.customer_name}</span>
                <span className="shrink-0 font-semibold tabular-nums">{formatINR(o.total)}</span>
              </span>
              <span className="text-sm text-muted">{o.itemsSummary}</span>
              <span className="flex flex-wrap gap-2">
                <span className="rounded-full bg-info-soft px-2 py-0.5 text-xs font-medium text-info-ink">Customer order</span>
                {actionReasons(o).map((r) => (<span key={r} className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger-ink">{WHY[r]}</span>))}
              </span>
            </Link>
            <CustomerOrderActions order={o} />
          </li>
        ))}
      </ul>
    </section>
  )
}
