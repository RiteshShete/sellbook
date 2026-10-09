import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Page } from '../../app/Page'
import { Button, EmptyState, ErrorState, Skeleton } from '../../components/ui'
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
      <Page title={title} back="/">
        <div className="flex flex-col gap-3" role="status" aria-label="Loading">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Page>
    )
  }
  if (order.isError) {
    return (
      <Page title={title} back="/">
        <ErrorState error={order.error} onRetry={() => void order.refetch()} />
      </Page>
    )
  }
  if (order.data === null) {
    return (
      <Page title={title} back="/">
        <EmptyState
          title="Order not found"
          description="It may have been moved to Trash."
          action={
            <Link to="/" className="font-medium underline underline-offset-4">
              Back to Home
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
          back="/"
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

/**
 * Edits the order as it was when editing began. If it is saved elsewhere meanwhile (refetch,
 * realtime), the typed changes stay and a notice offers to reload; saving the old version would
 * fail with SB409 anyway.
 */
function EditOrder({ order }: { order: OrderWithItems }) {
  const [base, setBase] = useState(order)
  const notice =
    order.version_no !== base.version_no ? (
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 text-sm" role="status">
        <p className="flex-1">This order was changed on another device or tab.</p>
        <Button variant="secondary" onClick={() => setBase(order)}>
          Reload
        </Button>
      </div>
    ) : undefined
  return <OrderForm key={base.version_no} order={base} notice={notice} />
}

export function OrderEditPage() {
  return <WithOrder title="Edit order" render={(o) => <EditOrder key={o.id} order={o} />} />
}
