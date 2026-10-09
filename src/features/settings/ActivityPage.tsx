import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../../app/Page'
import { Button, EmptyState, ErrorState, SegmentedControl, Skeleton } from '../../components/ui'
import { formatDateTime } from '../../lib/dates'
import { queryKeys } from '../../lib/queryKeys'
import { useAuth } from '../auth/useAuth'
import { ACTIVITY_PAGE, fetchActivity, type ActivityEntity, type AuditRow } from './api/activityApi'

const FILTERS: { value: ActivityEntity; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'order', label: 'Orders' },
  { value: 'product', label: 'Products' },
  { value: 'variant', label: 'Variants' },
  { value: 'settings', label: 'Settings' },
]

function useActivity(entity: ActivityEntity) {
  const { client } = useAuth()
  return useInfiniteQuery({
    queryKey: queryKeys.activity.list(entity),
    queryFn: ({ pageParam }) => fetchActivity(client, entity, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => (last.length === ACTIVITY_PAGE ? (last.at(-1)?.id ?? null) : null),
  })
}

function Row({ row }: { row: AuditRow }) {
  const text = (
    <>
      <p>{row.summary}</p>
      <p className="text-xs text-muted">{formatDateTime(row.created_at)}</p>
    </>
  )
  return (
    <li className="px-4 py-3">
      {(row.entity === 'order' || row.entity === 'bill') && row.entity_id ? (
        <Link to={`/orders/${row.entity_id}`} className="block">
          {text}
        </Link>
      ) : (
        text
      )}
    </li>
  )
}

/** Audit log: every change, newest first. */
export function ActivityPage() {
  const [entity, setEntity] = useState<ActivityEntity>('all')
  const activity = useActivity(entity)
  const rows = activity.data?.pages.flat() ?? []

  return (
    <Page title="Activity">
      <div className="flex flex-col gap-3">
        <SegmentedControl label="Show" options={FILTERS} value={entity} onChange={setEntity} />
        {activity.isPending ? (
          <div className="flex flex-col gap-2" role="status" aria-label="Loading">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : activity.isError ? (
          <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface text-sm">
              {rows.map((r) => (
                <Row key={r.id} row={r} />
              ))}
            </ul>
            {activity.hasNextPage && (
              <Button
                variant="secondary"
                disabled={activity.isFetchingNextPage}
                onClick={() => void activity.fetchNextPage()}
              >
                {activity.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          </>
        )}
      </div>
    </Page>
  )
}
