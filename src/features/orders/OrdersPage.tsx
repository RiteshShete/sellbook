import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Page } from '../../app/Page'
import { EmptyState, ErrorState, SegmentedControl, Skeleton } from '../../components/ui'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { LIST_LIMIT, type OrderTab } from './api/ordersApi'
import { OrderCard } from './components/OrderCard'
import { useOrders } from './hooks/useOrders'

const TABS: { value: OrderTab; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'ready', label: 'Ready' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

const isTab = (v: string | null): v is OrderTab => TABS.some((t) => t.value === v)

const newLink =
  'inline-flex min-h-11 items-center gap-1 rounded-xl bg-primary px-4 font-medium text-primary-fg'

export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: OrderTab = isTab(raw) ? raw : 'new'
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search.trim(), 300)
  const orders = useOrders(tab, term)

  const action = (
    <Link to="/orders/new" className={newLink}>
      <Plus className="h-5 w-5" /> New
    </Link>
  )

  return (
    <Page title="Orders" action={action}>
      <div className="flex flex-col gap-3">
        <SegmentedControl
          label="Order status"
          options={TABS}
          value={tab}
          onChange={(t) => setParams({ tab: t }, { replace: true })}
        />
        <label className="relative block">
          <span className="sr-only">Search orders</span>
          <Search className="pointer-events-none absolute top-3 left-3 h-5 w-5 text-muted" />
          <input
            type="search"
            placeholder="Name, phone, order or bill no."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-border bg-surface pr-3 pl-10 outline-none focus:border-primary"
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
            action={term ? undefined : action}
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
    </Page>
  )
}
