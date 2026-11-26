import { MapPin, MessageCircle, Phone } from 'lucide-react'
import { formatDate } from '../../../lib/dates'
import { toTelLink } from '../../../lib/phone'
import { addressText, isCustomerOrder, mapsLink } from '../customerOrders'
import type { Order } from '../schemas'
import { CustomerOrderActions } from './CustomerOrderActions'

const PAYMENT_LINE: Record<string, string> = {
  none: 'Not paid yet',
  claimed: 'The customer says they paid: check your bank',
  verified: 'Paid and confirmed by you',
  rejected: 'You told the customer it was not received',
}

const linkClass = 'inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-strong px-4 text-sm font-medium'

/** On the order page: that it came from the storefront, who and where, how they pay, and what the shop can do next. */
export function CustomerOrderPanel({ order }: { order: Order }) {
  if (!isCustomerOrder(order)) return null
  const a = order.delivery_address
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4" aria-label="Customer order">
      <p className="w-fit rounded-full bg-info-soft px-3 py-1 text-sm font-medium text-info-ink">Customer order</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Get it by</dt>
        <dd>{order.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}{order.due_date ? ` · ${formatDate(order.due_date)}` : ''}</dd>
        <dt className="text-muted">Pays</dt>
        <dd>{order.payment_method === 'upi' ? 'UPI' : 'On delivery or pickup'} · {order.payment_status === 'paid' ? 'paid' : (PAYMENT_LINE[order.payment_claim_status ?? 'none'] ?? 'Not paid yet')}</dd>
        {order.confirmation_status === 'declined' && (<><dt className="text-muted">Declined</dt><dd>{order.decline_reason}</dd></>)}
        {order.payment_claim_status === 'rejected' && order.payment_reject_reason && (<><dt className="text-muted">Not received</dt><dd>{order.payment_reject_reason}</dd></>)}
      </dl>
      {a && <p className="text-sm"><span className="text-muted">Deliver to:</span> {a.name}, {addressText(a)}</p>}
      <div className="flex flex-wrap gap-2">
        {order.customer_phone && (
          <a href={toTelLink(order.customer_phone)} className={linkClass}><Phone className="h-4 w-4" aria-hidden /> Call</a>
        )}
        {order.customer_phone && (
          <a href={`https://wa.me/${order.customer_phone}`} target="_blank" rel="noreferrer" className={linkClass}><MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp</a>
        )}
        {a && <a href={mapsLink(a)} target="_blank" rel="noreferrer" className={linkClass}><MapPin className="h-4 w-4" aria-hidden /> Navigate</a>}
      </div>
      <CustomerOrderActions order={order} />
    </section>
  )
}
