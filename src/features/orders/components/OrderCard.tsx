import { Link } from 'react-router-dom'
import { formatDate } from '../../../lib/dates'
import { pluralize } from '../../../lib/format'
import { formatINR } from '../../../lib/money'
import type { OrderListRow } from '../schemas'
import { DueBadge, PaymentBadge, StatusBadge } from './OrderBadges'

export function OrderCard({ order }: { order: OrderListRow }) {
  return (
    <li>
      <Link to={`/orders/${order.id}`} className="flex flex-col gap-1.5 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate font-medium">
            <span className="text-muted">#{order.order_no}</span> {order.customer_name}
          </span>
          <span className="shrink-0 font-semibold">{formatINR(order.total)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <StatusBadge status={order.status} />
          <PaymentBadge order={order} />
          <DueBadge order={order} />
          <span className="ml-auto">
            {pluralize(order.units, 'item')}
            {order.weight.text && ` · ${order.weight.text}`} · {formatDate(order.order_date)}
          </span>
        </div>
      </Link>
    </li>
  )
}
