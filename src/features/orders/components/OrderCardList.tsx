import type { ReactNode } from 'react'
import { sortByDue } from '../dueGroups'
import { useLeavingRows } from '../hooks/useLeavingRows'
import type { OrderListRow } from '../schemas'

/**
 * Order cards, one card per order, earliest due date first. No group headings: each card's own
 * due chip (Overdue, Due today, ...) already says it. Home (to make) and Delivery (to deliver)
 * share it. An order that leaves the list (marked ready, delivered) fades and collapses for a
 * moment instead of vanishing.
 */
export function OrderCardList({
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
  const tone = tinted
    ? '[&>li]:border-order-card-border [&>li]:bg-order-card'
    : '[&>li]:border-border [&>li]:bg-surface'

  return (
    // Each <li> is its own card; the list's negative bottom margin cancels the last card's gap.
    <ul
      className={`stagger-in -mb-3 flex flex-col [&>li]:mb-3 [&>li]:overflow-hidden [&>li]:rounded-2xl [&>li]:border ${tone}`}
    >
      {sortByDue([...orders, ...leaving]).map((o) =>
        leavingIds.has(o.id) ? (
          <li key={o.id} aria-hidden inert className="row-out">
            <ul className="min-h-0 overflow-hidden">{renderItem(o)}</ul>
          </li>
        ) : (
          renderItem(o)
        ),
      )}
    </ul>
  )
}
