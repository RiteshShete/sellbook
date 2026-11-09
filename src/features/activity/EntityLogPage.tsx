import { Link, useParams } from 'react-router-dom'
import { Page } from '../../app/Page'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui'
import type { EntityKind } from './api/activityApi'
import { ActivityFeed } from './components/ActivityFeed'
import { useEntityItem } from './hooks/useActivity'

function asKind(value: string | undefined): EntityKind | null {
  return value === 'order' || value === 'product' || value === 'variant' ? value : null
}

/** The log of one order (#13), product or variant, newest first. */
export function EntityLogPage() {
  const { kind: rawKind, id = '' } = useParams()
  const kind = asKind(rawKind)
  if (!kind) return <EmptyState title="Not found" />
  return <EntityLog kind={kind} id={id} />
}

function EntityLog({ kind, id }: { kind: EntityKind; id: string }) {
  const item = useEntityItem(kind, id)
  const title = item.data
    ? kind === 'order'
      ? `Order ${item.data.title}`
      : item.data.title
    : 'Activity'
  return (
    <Page title={title} subtitle={item.data?.subtitle ?? undefined} back="/activity">
      <div className="flex flex-col gap-4">
        {item.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : item.isError ? (
          <ErrorState error={item.error} onRetry={() => void item.refetch()} />
        ) : item.data === null ? (
          <EmptyState title="Not found" />
        ) : (
          <>
            {kind === 'order' && !item.data.trashed && (
              <Link to={`/orders/${id}`} className="text-sm font-medium underline">
                Open this order
              </Link>
            )}
            <ActivityFeed tab={kind} entityId={id} />
          </>
        )}
      </div>
    </Page>
  )
}
