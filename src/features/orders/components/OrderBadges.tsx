import { Badge } from '../../../components/ui'
import { formatDate, todayIST } from '../../../lib/dates'
import type { Order, OrderStatus } from '../schemas'

const STATUS: Record<
  OrderStatus,
  { label: string; tone: 'info' | 'warning' | 'success' | 'neutral' }
> = {
  new: { label: 'New', tone: 'info' },
  ready: { label: 'Ready', tone: 'warning' },
  delivered: { label: 'Delivered', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
}

export function PaymentBadge({ order }: { order: Pick<Order, 'payment_status' | 'payment_mode'> }) {
  if (order.payment_status === 'pending') return <Badge tone="danger">Unpaid</Badge>
  return <Badge tone="success">Paid · {order.payment_mode === 'cash' ? 'Cash' : 'Online'}</Badge>
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
  return <Badge>Due {formatDate(order.due_date).slice(0, 6)}</Badge>
}
