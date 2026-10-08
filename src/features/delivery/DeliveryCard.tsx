import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui'
import { formatINR } from '../../lib/money'
import { PaymentBadge } from '../orders/components/OrderBadges'
import { PaymentSheet } from '../orders/components/PaymentSheet'
import { useSetStatus } from '../orders/hooks/useOrderActions'
import type { OrderListRow } from '../orders/schemas'

/** One ready order: what to deliver, one-tap delivered, payment shortcut. */
export function DeliveryCard({ order }: { order: OrderListRow }) {
  const setStatus = useSetStatus()
  const [payOpen, setPayOpen] = useState(false)

  return (
    <li className="flex flex-col gap-2 p-4">
      <Link to={`/orders/${order.id}`} className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate font-medium">
            <span className="text-muted">#{order.order_no}</span> {order.customer_name}
          </span>
          <span className="shrink-0 font-semibold">{formatINR(order.total)}</span>
        </div>
        <p className="text-sm text-muted">{order.itemsSummary || 'No items'}</p>
      </Link>
      <div className="flex items-center gap-2">
        <PaymentBadge order={order} />
        <Button variant="ghost" className="ml-auto" onClick={() => setPayOpen(true)}>
          Payment
        </Button>
        <Button
          disabled={setStatus.isPending}
          onClick={() => setStatus.mutate({ order, from: 'ready', to: 'delivered' })}
        >
          Delivered
        </Button>
      </div>
      <PaymentSheet order={order} open={payOpen} onClose={() => setPayOpen(false)} />
    </li>
  )
}
