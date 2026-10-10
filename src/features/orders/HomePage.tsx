import { Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Page } from '../../app/Page'
import { EmptyState, ErrorState, SegmentedControl, Skeleton } from '../../components/ui'
import { DueGroupedList } from './components/DueGroupedList'
import { HomeOverview } from './components/HomeOverview'
import { FAB_CLEARANCE, NewOrderFab } from './components/NewOrderFab'
import { NewOrderCard } from './components/NewOrderCard'
import { PrepList } from './components/PrepList'
import { useOrders } from './hooks/useOrders'

type View = 'orders' | 'prep'

const VIEWS: { value: View; label: string }[] = [
  { value: 'orders', label: 'New orders' },
  { value: 'prep', label: 'To prepare' },
]

const VIEW_HINT: Record<View, string> = {
  orders: 'Each new order on its own, with one tap to mark it ready.',
  prep: 'All new orders added up per product: what to make.',
}

/**
 * Home: the "make it" screen. Overview of the day, then the New orders (one tap to mark Ready)
 * or the same orders summed per product ("To prepare"). Ready orders live on Delivery; older
 * orders are one search away (All orders).
 */
export function HomePage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'prep' ? 'prep' : 'orders'
  const setView = (v: View) => setParams(v === 'prep' ? { view: 'prep' } : {}, { replace: true })

  return (
    <Page title="Home">
      <div className={`flex flex-col gap-4 ${FAB_CLEARANCE}`}>
        <HomeOverview />
        <Link
          to="/orders"
          className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface px-3 text-muted"
        >
          <Search className="h-5 w-5" /> Search all orders
        </Link>
        <SegmentedControl label="Show" options={VIEWS} value={view} onChange={setView} />
        <p className="-mt-2 text-sm text-muted">{VIEW_HINT[view]}</p>
        {view === 'prep' ? <PrepList /> : <NewOrders />}
      </div>
      <NewOrderFab />
    </Page>
  )
}

function NewOrders() {
  const orders = useOrders('new', '')

  if (orders.isPending) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Loading">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }
  if (orders.isError) {
    return <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
  }
  if (orders.data.length === 0) {
    return (
      <EmptyState
        title="No new orders"
        description="Orders you add show up here until you mark them ready."
      />
    )
  }
  return (
    <DueGroupedList
      orders={orders.data}
      renderItem={(o) => <NewOrderCard key={o.id} order={o} />}
    />
  )
}
