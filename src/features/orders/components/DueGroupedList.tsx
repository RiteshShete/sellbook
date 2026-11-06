import type { ReactNode } from 'react'
import { groupByDue } from '../dueGroups'
import { useLeavingRows } from '../hooks/useLeavingRows'
import type { OrderListRow } from '../schemas'

/**
 * Orders grouped Overdue / Due today / Due tomorrow / Later / No due date. Home (to make) and
 * Delivery (to deliver) share it, so both work queues read the same way. An order that leaves the
 * list (marked ready, delivered) fades and collapses for a moment instead of vanishing.
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
  const leaving = useLeavingRows(orders)
  const leavingIds = new Set(leaving.map((o) => o.id))

  return (
    <div className="flex flex-col gap-5">
      {groupByDue([...orders, ...leaving]).map((g) => (
        <section key={g.key} className="flex flex-col gap-2">
          <h2
            className={`text-sm font-semibold ${g.key === 'overdue' ? 'text-danger' : 'text-muted'}`}
          >
            {g.label} · {g.orders.filter((o) => !leavingIds.has(o.id)).length}
          </h2>
          <ul
            className={`stagger-in divide-y overflow-hidden rounded-2xl border divide-border ${tinted ? 'border-order-card-border bg-order-card' : 'border-border bg-surface'}`}
          >
            {g.orders.map((o) =>
              leavingIds.has(o.id) ? (
                <li key={o.id} aria-hidden inert className="row-out">
                  <ul className="min-h-0 overflow-hidden">{renderItem(o)}</ul>
                </li>
              ) : (
                renderItem(o)
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  )
}
