import { Link } from 'react-router-dom'
import { ActionButton } from '../../../components/ui'
import { formatINR } from '../../../lib/money'
import { useOrderBusy, useSetStatus } from '../hooks/useOrderActions'
import type { OrderListRow } from '../schemas'
import { DueBadge } from './OrderBadges'

/** A New order on Home: what to make, and one tap to mark it Ready (Undo in the toast). */
export function NewOrderCard({ order }: { order: OrderListRow }) {
  const setStatus = useSetStatus()
  const busy = useOrderBusy(order.id)
  const empty = order.units === 0 // B9: needs at least one item before Ready

  return (
    <li className="flex flex-col gap-2 p-4">
      <Link to={`/orders/${order.id}`} className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate font-medium">
            <span className="text-muted">#{order.order_no}</span> {order.customer_name}
          </span>
          <span className="shrink-0 font-semibold tabular-nums">{formatINR(order.total)}</span>
        </div>
        <p className="text-sm text-muted">
          {order.itemsSummary || 'No items yet'}
          {order.weight.text && ` · ${order.weight.text}`}
        </p>
      </Link>
      <div className="flex items-center gap-2">
        <DueBadge order={order} />
        {empty ? (
          <Link
            to={`/orders/${order.id}/edit`}
            className="ml-auto inline-flex min-h-11 items-center rounded-xl border border-border-strong px-4 text-sm font-semibold"
          >
            Add items
          </Link>
        ) : (
          <ActionButton
            kind="ready"
            className="ml-auto"
            disabled={busy}
            onClick={() => setStatus.mutate({ order, from: order.status, to: 'ready' })}
          >
            Mark ready
          </ActionButton>
        )}
      </div>
    </li>
  )
}
