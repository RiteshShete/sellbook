import { Link } from 'react-router-dom'
import { Page } from '../../app/Page'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { pluralize } from '../../lib/format'
import { DueGroupedList } from '../orders/components/DueGroupedList'
import { FAB_CLEARANCE, NewOrderFab } from '../orders/components/NewOrderFab'
import { useOrders } from '../orders/hooks/useOrders'
import { DeliveryCard } from './DeliveryCard'

/** The "hand it over" screen: exactly the `ready` orders, grouped by due date. */
export function DeliveryPage() {
  const orders = useOrders('ready', '')

  return (
    <Page title="Delivery">
      <div className={FAB_CLEARANCE}>
        {orders.isPending ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Loading">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : orders.isError ? (
          <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
        ) : orders.data.length === 0 ? (
          <EmptyState
            title="Nothing to deliver"
            description="Orders you mark ready on Home show up here."
            action={
              <Link to="/" className="font-medium underline underline-offset-4">
                Go to Home
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">{pluralize(orders.data.length, 'order')} ready</p>
            <DueGroupedList
              orders={orders.data}
              renderItem={(o) => <DeliveryCard key={o.id} order={o} />}
            />
          </div>
        )}
      </div>
      <NewOrderFab />
    </Page>
  )
}
