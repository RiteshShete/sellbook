import { Phone } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ActionButton } from '../../components/ui'
import { formatINR } from '../../lib/money'
import { toTelLink } from '../../lib/phone'
import { DueBadge, PaymentBadge } from '../orders/components/OrderBadges'
import { useDeliver, useOrderBusy } from '../orders/hooks/useOrderActions'
import type { OrderListRow } from '../orders/schemas'
import { DeliverSheet } from './DeliverSheet'

/**
 * One ready order: what to hand over, a call button, and Delivered. Unpaid orders ask about the
 * payment in the same step; already-paid ones are delivered straight away.
 */
export function DeliveryCard({ order }: { order: OrderListRow }) {
  const deliver = useDeliver()
  const busy = useOrderBusy(order.id)
  const [sheetOpen, setSheetOpen] = useState(false)
  const paid = order.payment_status === 'paid'

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
          {order.itemsSummary || 'No items'}
          {order.weight.text && ` · ${order.weight.text}`}
        </p>
      </Link>
      <div className="flex items-center gap-2">
        <PaymentBadge order={order} />
        <DueBadge order={order} />
        {order.customer_phone && (
          <a
            href={toTelLink(order.customer_phone)}
            aria-label={`Call ${order.customer_name}`}
            className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border-strong"
          >
            <Phone className="h-5 w-5" />
          </a>
        )}
        <ActionButton
          kind="delivered"
          className={order.customer_phone ? '' : 'ml-auto'}
          disabled={busy}
          onClick={() => (paid ? deliver.mutate({ order, paid: null }) : setSheetOpen(true))}
        >
          Delivered
        </ActionButton>
      </div>
      <DeliverSheet order={order} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </li>
  )
}
