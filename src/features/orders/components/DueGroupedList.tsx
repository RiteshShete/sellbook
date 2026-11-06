import type { ReactNode } from 'react'
import { groupByDue } from '../dueGroups'
import type { OrderListRow } from '../schemas'

/**
 * Orders grouped Overdue / Due today / Due tomorrow / Later / No due date. Home (to make) and
 * Delivery (to deliver) share it, so both work queues read the same way.
 */
export function DueGroupedList({
  orders,
  renderItem,
  tinted = false,
}: {
  orders: OrderListRow[]
  renderItem: (order: OrderListRow) => ReactNode
  /** Home's pale-yellow cards (open orders); Delivery keeps the plain surface. */
  tinted?: boolean
}) {
  return (
    <div className="flex flex-col gap-5">
      {groupByDue(orders).map((g) => (
        <section key={g.key} className="flex flex-col gap-2">
          <h2
            className={`text-sm font-semibold ${g.key === 'overdue' ? 'text-danger' : 'text-muted'}`}
          >
            {g.label} · {g.orders.length}
          </h2>
          <ul
            className={`divide-y divide-border overflow-hidden rounded-2xl border ${tinted ? 'border-order-card-border bg-order-card' : 'border-border bg-surface'}`}
          >
            {g.orders.map(renderItem)}
          </ul>
        </section>
      ))}
    </div>
  )
}
