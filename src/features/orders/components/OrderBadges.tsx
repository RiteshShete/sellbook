import { Badge } from '../../../components/ui'
import type { BadgeKind } from '../../../lib/actionStyles'
import { formatDayMonth, todayIST } from '../../../lib/dates'
import { STATUS_LABEL, paymentLabel, paymentState } from '../pipeline'
import type { Order, OrderStatus } from '../schemas'

const STATUS_KIND: Record<OrderStatus, BadgeKind> = {
  new: 'new',
  ready: 'ready',
  delivered: 'delivered',
  cancelled: 'cancelled',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge kind={STATUS_KIND[status]}>{STATUS_LABEL[status]}</Badge>
}

export function PaymentBadge({ order }: { order: Pick<Order, 'payment_status' | 'payment_mode'> }) {
  const p = paymentState(order)
  return <Badge kind={p.payment_status === 'paid' ? 'paid' : 'notPaid'}>{paymentLabel(p)}</Badge>
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
  if (order.due_date < today) return <Badge kind="overdue">Overdue</Badge>
  if (order.due_date === today) return <Badge kind="dueToday">Due today</Badge>
  return <Badge>Due {formatDayMonth(order.due_date)}</Badge>
}
