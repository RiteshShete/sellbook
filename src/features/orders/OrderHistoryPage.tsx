import { useNavigate, useParams } from 'react-router-dom'
import { Page } from '../../app/Page'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { VersionList } from './components/VersionList'
import { useOrderVersions } from './hooks/useOrderHistory'
import { useOrder } from './hooks/useOrders'

export function OrderHistoryPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const order = useOrder(id)
  const versions = useOrderVersions(id)
  const title = order.data ? `History #${order.data.order_no}` : 'History'

  const retry = () => {
    void order.refetch()
    void versions.refetch()
  }
  return (
    <Page title={title}>
      {order.isPending || versions.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : order.isError ? (
        <ErrorState error={order.error} onRetry={retry} />
      ) : versions.isError ? (
        <ErrorState error={versions.error} onRetry={retry} />
      ) : !order.data ? (
        <EmptyState title="Order not found" description="It may be in Trash." />
      ) : versions.data.length === 0 ? (
        <EmptyState title="No history yet" />
      ) : (
        <VersionList
          order={order.data}
          versions={versions.data}
          onRolledBack={() => void navigate(`/orders/${id}`)}
        />
      )}
    </Page>
  )
}
