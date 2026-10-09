import { Badge } from '../../../components/ui'
import { formatDayMonth, todayIST } from '../../../lib/dates'
import { STATUS_LABEL, paymentLabel, paymentState } from '../pipeline'
import type { Order, OrderStatus } from '../schemas'

const STATUS_TONE: Record<OrderStatus, 'info' | 'warning' | 'success' | 'neutral'> = {
  new: 'info',
  ready: 'warning',
  delivered: 'success',
  cancelled: 'neutral',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}

export function PaymentBadge({ order }: { order: Pick<Order, 'payment_status' | 'payment_mode'> }) {
  const p = paymentState(order)
  return <Badge tone={p.payment_status === 'paid' ? 'success' : 'danger'}>{paymentLabel(p)}</Badge>
}

/** "Overdue" / "Due today" / "Due 12 Oct" for open orders; nothing once delivered or cancelled. */
export function DueBadge({
  order,
  today = todayIST(),
}: {
  order: Pick<Order, 'due_date' | 'status'>
  today?: string
}) {
  if (!order.due_date || order.status === 'delivered' || order.status === 'cancelled') return null
  if (order.due_date < today) return <Badge tone="danger">Overdue</Badge>
  if (order.due_date === today) return <Badge tone="warning">Due today</Badge>
  return <Badge>Due {formatDayMonth(order.due_date)}</Badge>
}
