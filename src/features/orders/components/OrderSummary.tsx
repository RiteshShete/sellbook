import { MessageCircle, Phone } from 'lucide-react'
import { formatDate } from '../../../lib/dates'
import { formatPhone } from '../../../lib/format'
import { formatINR } from '../../../lib/money'
import { toWaMeLink } from '../../../lib/phone'
import type { OrderWithItems } from '../schemas'
import { DueBadge, PaymentBadge, StatusBadge } from './OrderBadges'

const iconLink =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface'

/** Read-only view of an order: customer, dates, items, totals. */
export function OrderSummary({ order }: { order: OrderWithItems }) {
  const wa = order.customer_phone ? toWaMeLink(order.customer_phone) : null
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge status={order.status} />
        <PaymentBadge order={order} />
        <DueBadge order={order} />
      </div>

      <section className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{order.customer_name}</p>
          <p className="text-sm text-muted">
            {order.customer_phone ? formatPhone(order.customer_phone) : 'No phone'}
          </p>
        </div>
        {order.customer_phone && (
          <a href={`tel:+${order.customer_phone}`} className={iconLink} aria-label="Call">
            <Phone className="h-5 w-5" />
          </a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className={iconLink} aria-label="WhatsApp">
            <MessageCircle className="h-5 w-5" />
          </a>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-muted">Ordered</dt>
          <dd>{formatDate(order.order_date)}</dd>
        </div>
        <div>
          <dt className="text-muted">Due</dt>
          <dd>{order.due_date ? formatDate(order.due_date) : '—'}</dd>
        </div>
      </dl>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        {order.items.length === 0 ? (
          <p className="p-4 text-sm text-muted">No items yet. Edit the order to add some.</p>
        ) : (
          <ul className="divide-y divide-border">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-baseline gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  {i.product_name} · {i.variant_name}
                  <span className="block text-sm text-muted">
                    {i.quantity} × {formatINR(i.unit_price)}
                  </span>
                </span>
                <span className="font-medium">{formatINR(i.line_total)}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className="flex flex-col gap-1 border-t border-border bg-surface-2 px-4 py-3 text-sm">
          {order.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Discount</dt>
              <dd>− {formatINR(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatINR(order.total)}</dd>
          </div>
        </dl>
      </section>

      {order.notes && (
        <section className="rounded-2xl bg-surface-2 p-4 text-sm whitespace-pre-wrap">
          {order.notes}
        </section>
      )}
    </div>
  )
}
