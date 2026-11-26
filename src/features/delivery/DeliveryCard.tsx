import { MapPin, Phone } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatedActionButton } from '../../components/ui'
import { formatINR } from '../../lib/money'
import { toTelLink } from '../../lib/phone'
import { DueBadge, PaymentBadge } from '../orders/components/OrderBadges'
import { addressText, isCustomerOrder, mapsLink } from '../orders/customerOrders'
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
        {isCustomerOrder(order) && (
          <p className="text-sm">
            <span className="font-medium">{order.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</span>
            {order.delivery_address && `: ${addressText(order.delivery_address)}`}
            {order.payment_method === 'cod' && order.payment_status !== 'paid' && ` · collect ${formatINR(order.total)}`}
          </p>
        )}
      </Link>
      <div className="flex items-center gap-2">
        <PaymentBadge order={order} />
        <DueBadge order={order} />
        {order.delivery_address && (
          <a
            href={mapsLink(order.delivery_address)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Navigate to ${order.customer_name}`}
            className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border-strong"
          >
            <MapPin className="h-5 w-5" />
          </a>
        )}
        {order.customer_phone && (
          <a
            href={toTelLink(order.customer_phone)}
            aria-label={`Call ${order.customer_name}`}
            className={`${order.delivery_address ? '' : 'ml-auto '}inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border-strong`}
          >
            <Phone className="h-5 w-5" />
          </a>
        )}
        <AnimatedActionButton
          kind="delivered"
          animation="delivery"
          className={order.customer_phone || order.delivery_address ? '' : 'ml-auto'}
          disabled={busy}
          onAction={() => (paid ? deliver.mutate({ order, paid: null }) : setSheetOpen(true))}
        >
          Delivered
        </AnimatedActionButton>
      </div>
      <DeliverSheet order={order} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </li>
  )
}
