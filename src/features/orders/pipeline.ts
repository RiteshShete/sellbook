import type { OrderTab } from './api/ordersApi'
import { ORDER_STATUSES, type OrderStatus } from './schemas'

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

/** All orders screen filters: All first (it is a search screen), then one per status. */
export const ORDER_TABS: { value: OrderTab; label: string }[] = [
  { value: 'all', label: 'All' },
  ...ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
]

export const isOrderTab = (v: string | null): v is OrderTab => ORDER_TABS.some((t) => t.value === v)

export interface StatusMove {
  to: OrderStatus
  label: string
  kind: 'forward' | 'back' | 'cancel' | 'restore'
}

/** The moves the server allows from a status (mirrors set_order_status, B1). */
export function statusMoves(o: {
  status: OrderStatus
  cancelled_from: OrderStatus | null
}): StatusMove[] {
  const cancel: StatusMove = { to: 'cancelled', label: 'Cancel order', kind: 'cancel' }
  switch (o.status) {
    case 'new':
      return [{ to: 'ready', label: 'Mark ready', kind: 'forward' }, cancel]
    case 'ready':
      return [
        { to: 'delivered', label: 'Mark delivered', kind: 'forward' },
        { to: 'new', label: 'Back to new', kind: 'back' },
        cancel,
      ]
    case 'delivered':
      return [{ to: 'ready', label: 'Back to ready', kind: 'back' }, cancel]
    case 'cancelled':
      return o.cancelled_from
        ? [
            {
              to: o.cancelled_from,
              label: `Restore (${STATUS_LABEL[o.cancelled_from]})`,
              kind: 'restore',
            },
          ]
        : []
  }
}

/** B9: ready/delivered need at least one item. */
export function needsItems(to: OrderStatus): boolean {
  return to === 'ready' || to === 'delivered'
}

/** Toast text after a move. Undo of any move is simply the move back to `from`. */
export function moveMessage(orderNo: number, from: OrderStatus, to: OrderStatus): string {
  if (to === 'cancelled') return `#${orderNo} cancelled`
  if (from === 'cancelled') return `#${orderNo} restored to ${STATUS_LABEL[to]}`
  return `#${orderNo} → ${STATUS_LABEL[to]}`
}

export type PaymentState =
  | { payment_status: 'pending'; payment_mode: null }
  | { payment_status: 'paid'; payment_mode: 'online' | 'cash' }

export function paymentLabel(p: PaymentState): string {
  return p.payment_status === 'pending'
    ? 'Not paid'
    : `Paid · ${p.payment_mode === 'cash' ? 'Cash' : 'Online'}`
}

/** Narrows the loose row fields into a valid payment state (B2 holds in the DB). */
export function paymentState(o: {
  payment_status: 'pending' | 'paid'
  payment_mode: 'online' | 'cash' | null
}): PaymentState {
  return o.payment_status === 'paid' && o.payment_mode
    ? { payment_status: 'paid', payment_mode: o.payment_mode }
    : { payment_status: 'pending', payment_mode: null }
}
