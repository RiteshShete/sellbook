import { Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import headerBg from '../../assets/home/header-bg.png'
import { EmptyState, ErrorState, Skeleton, UnderlineTabs } from '../../components/ui'
import { DueGroupedList } from './components/DueGroupedList'
import { HomeOverview } from './components/HomeOverview'
import { FAB_CLEARANCE, NewOrderFab } from './components/NewOrderFab'
import { NewOrderCard } from './components/NewOrderCard'
import { PrepList } from './components/PrepList'
import { useOrders } from './hooks/useOrders'

type View = 'orders' | 'prep'

const VIEWS: { value: View; label: string }[] = [
  { value: 'orders', label: 'New Orders' },
  { value: 'prep', label: 'To Prepare' },
]

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
    <>
      <div className="relative pt-[env(safe-area-inset-top)]">
        <HeaderBackdrop />
        <header className="relative mx-auto flex min-h-14 max-w-2xl items-center justify-between gap-1 px-4">
          <h1 className="font-display min-w-0 flex-1 truncate text-2xl leading-[1.6]">Sellbook</h1>
          <SearchLink />
        </header>
        <div className="relative mx-auto w-full max-w-2xl min-w-0 px-4 pt-4">
          <HomeOverview />
        </div>
      </div>
      <div
        className={`mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-4 px-4 pt-4 ${FAB_CLEARANCE}`}
      >
        <UnderlineTabs label="Show" options={VIEWS} value={view} onChange={setView} />
        {view === 'prep' ? <PrepList /> : <NewOrders />}
      </div>
      <NewOrderFab />
    </>
  )
}

/** Sky photo behind the title row and overview cards, fading into the cream page below. */
function HeaderBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[calc(169px+env(safe-area-inset-top))] overflow-hidden"
    >
      <img src={headerBg} alt="" className="size-full object-cover object-top" />
      <div className="absolute inset-0 bg-(image:--home-header-fade)" />
    </div>
  )
}

/** Search field look-alike beside the title: opens the all-orders search, ready to type. */
function SearchLink() {
  return (
    <Link
      to="/orders"
      aria-label="Search all orders"
      className="flex min-h-11 w-[183px] max-w-[55%] shrink-0 items-center gap-3 rounded-xl border border-border-strong bg-surface/60 px-3 text-sm font-medium text-body"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden /> Search orders
    </Link>
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
      tinted
      orders={orders.data}
      renderItem={(o) => <NewOrderCard key={o.id} order={o} />}
    />
  )
}
