import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Page } from '../../app/Page'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { BillCard } from '../billing/components/BillCard'
import { OrderActions } from './components/OrderActions'
import { OrderForm } from './components/OrderForm'
import { OrderMoreActions } from './components/OrderMoreActions'
import { OrderSummary } from './components/OrderSummary'
import { useOrder } from './hooks/useOrders'
import type { OrderWithItems } from './schemas'

const editLink =
  'inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-4 font-medium'

/** Loads /orders/:id and renders loading / error / not-found states around `render`. */
function WithOrder({ title, render }: { title: string; render: (o: OrderWithItems) => ReactNode }) {
  const { id = '' } = useParams()
  const order = useOrder(id)

  if (order.isPending) {
    return (
      <Page title={title}>
        <div className="flex flex-col gap-3" role="status" aria-label="Loading">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Page>
    )
  }
  if (order.isError) {
    return (
      <Page title={title}>
        <ErrorState error={order.error} onRetry={() => void order.refetch()} />
      </Page>
    )
  }
  if (order.data === null) {
    return (
      <Page title={title}>
        <EmptyState
          title="Order not found"
          description="It may have been moved to Trash."
          action={
            <Link to="/orders" className="font-medium text-primary">
              Back to Orders
            </Link>
          }
        />
      </Page>
    )
  }
  return render(order.data)
}

export function OrderNewPage() {
  return <OrderForm />
}

export function OrderDetailPage() {
  return (
    <WithOrder
      title="Order"
      render={(o) => (
        <Page
          title={`Order #${o.order_no}`}
          action={
            <Link to={`/orders/${o.id}/edit`} className={editLink}>
              Edit
            </Link>
          }
        >
          <div className="flex flex-col gap-4">
            <OrderSummary order={o} />
            <OrderActions order={o} />
            <BillCard order={o} />
            <OrderMoreActions order={o} />
          </div>
        </Page>
      )}
    />
  )
}

export function OrderEditPage() {
  return (
    <WithOrder
      title="Edit order"
      // Keyed by version: if another device saved meanwhile, the form reloads with fresh data.
      render={(o) => <OrderForm key={`${o.id}:${o.version_no}`} order={o} />}
    />
  )
}
