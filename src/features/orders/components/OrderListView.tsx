import { Search } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { EmptyState, ErrorState, SegmentedControl, Skeleton } from '../../../components/ui'
import { useDebouncedValue } from '../../../lib/useDebouncedValue'
import { LIST_LIMIT, type OrderTab } from '../api/ordersApi'
import { useOrders } from '../hooks/useOrders'
import { OrderCard } from './OrderCard'

export const ORDER_TABS: { value: OrderTab; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'ready', label: 'Ready' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

interface Props {
  tab: OrderTab
  onTab: (tab: OrderTab) => void
  /** The "+ New" link, reused in the empty state. */
  newAction: ReactNode
}

/** Status tabs, search and the order list. */
export function OrderListView({ tab, onTab, newAction }: Props) {
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search.trim(), 300)
  const orders = useOrders(tab, term)

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl label="Order status" options={ORDER_TABS} value={tab} onChange={onTab} />
      <label className="relative block">
        <span className="sr-only">Search orders</span>
        <Search className="pointer-events-none absolute top-3 left-3 h-5 w-5 text-muted" />
        <input
          type="search"
          placeholder="Name, phone, order or bill no."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-border bg-surface pr-4 pl-10 outline-none focus:border-text focus:ring-1 focus:ring-text"
        />
      </label>

      {orders.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Loading">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
      ) : orders.data.length === 0 ? (
        <EmptyState
          title={term ? 'No matching orders' : 'No orders here'}
          description={term ? 'Try another name, phone or number.' : undefined}
          action={term ? undefined : newAction}
        />
      ) : (
        <>
          <ul
            className={`divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface ${orders.isPlaceholderData ? 'opacity-60' : ''}`}
          >
            {orders.data.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </ul>
          {orders.data.length === LIST_LIMIT && (
            <p className="text-center text-sm text-muted">
              Showing the latest {LIST_LIMIT}. Search to find older orders.
            </p>
          )}
        </>
      )}
    </div>
  )
}
