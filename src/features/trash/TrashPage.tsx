import { useState } from 'react'
import { Page } from '../../app/Page'
import { Button, EmptyState, ErrorState, SegmentedControl, Skeleton } from '../../components/ui'
import { formatDateTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import type { TrashTab } from './api/trashApi'
import { useRestore, useTrashList } from './useTrash'

const TABS: { value: TrashTab; label: string }[] = [
  { value: 'orders', label: 'Orders' },
  { value: 'products', label: 'Products' },
  { value: 'variants', label: 'Variants' },
]

/** Soft-deleted items. Nothing is ever hard-deleted from here (requirement 7). */
export function TrashPage() {
  const [tab, setTab] = useState<TrashTab>('orders')
  const list = useTrashList(tab)
  const restore = useRestore(tab)

  return (
    <Page title="Trash">
      <div className="flex flex-col gap-3">
        <SegmentedControl label="Trash type" options={TABS} value={tab} onChange={setTab} />
        {list.isPending ? (
          <div className="flex flex-col gap-2" role="status" aria-label="Loading">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.length === 0 ? (
          <EmptyState title="Trash is empty" description="Things you remove show up here." />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {list.data.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {row.title}
                    {row.amount !== null && (
                      <span className="font-normal text-muted"> · {formatINR(row.amount)}</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {row.detail} · removed {formatDateTime(row.deleted_at)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(row)}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Page>
  )
}
