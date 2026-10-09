import { Link } from 'react-router-dom'
import { Page } from '../../app/Page'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { pluralize } from '../../lib/format'
import { useOrders } from '../orders/hooks/useOrders'
import { DeliveryCard } from './DeliveryCard'
import { groupByDue } from './groupByDue'

/** The Delivery stack: exactly the `ready` orders, grouped by due date. */
export function DeliveryPage() {
  const orders = useOrders('ready', '')

  return (
    <Page title="Delivery">
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
          description="Orders you mark ready show up here."
          action={
            <Link to="/orders?tab=new" className="font-medium underline underline-offset-4">
              See new orders
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted">{pluralize(orders.data.length, 'order')} ready</p>
          {groupByDue(orders.data).map((g) => (
            <section key={g.key} className="flex flex-col gap-2">
              <h2
                className={`text-sm font-semibold ${g.key === 'overdue' ? 'text-danger' : 'text-muted'}`}
              >
                {g.label} · {g.orders.length}
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {g.orders.map((o) => (
                  <DeliveryCard key={o.id} order={o} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Page>
  )
}
