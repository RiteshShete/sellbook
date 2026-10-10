import { useState } from 'react'
import { Badge, Button, ConfirmDialog } from '../../../components/ui'
import { formatDateTime } from '../../../lib/dates'
import { formatINR } from '../../../lib/money'
import { versionDiff, type Version } from '../history'
import { useRollback } from '../hooks/useOrderHistory'
import type { Order } from '../schemas'

const REASON: Record<Version['reason'], string> = {
  create: 'Created',
  edit: 'Edited',
  status: 'Status',
  payment: 'Payment',
  delete: 'Trashed',
  restore: 'Restored',
  rollback: 'Rollback',
}

export interface VersionListProps {
  order: Pick<Order, 'id' | 'version_no'>
  /** Newest first, as returned by fetchVersions. */
  versions: Version[]
  onRolledBack: () => void
}

export function VersionList({ order, versions, onRolledBack }: VersionListProps) {
  const rollback = useRollback()
  const [target, setTarget] = useState<number | null>(null)

  return (
    <>
      <ol className="flex flex-col gap-3">
        {versions.map((v, i) => {
          const prev = versions[i + 1]
          const changes = prev ? versionDiff(prev.snapshot, v.snapshot) : []
          const current = v.version_no === order.version_no
          return (
            <li key={v.version_no} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold">v{v.version_no}</span>
                <Badge kind={current ? 'info' : 'neutral'}>
                  {current ? 'Current' : REASON[v.reason]}
                </Badge>
                <span className="ml-auto text-sm text-muted">{formatDateTime(v.created_at)}</span>
              </div>
              <p className="mt-1 text-sm">{v.summary}</p>
              {changes.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm text-muted">
                  {changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-sm text-muted">Total then: {formatINR(v.snapshot.total)}</p>
              {!current && (
                <Button
                  variant="ghost"
                  className="mt-1 -ml-4"
                  disabled={rollback.isPending}
                  onClick={() => setTarget(v.version_no)}
                >
                  Roll back to this version
                </Button>
              )}
            </li>
          )
        })}
      </ol>

      <ConfirmDialog
        open={target !== null}
        title={`Roll back to v${target ?? ''}?`}
        message="Items, prices, status and payment become exactly as they were then. This is saved as a new version, so you can undo it the same way."
        confirmLabel="Roll back"
        busy={rollback.isPending}
        onCancel={() => setTarget(null)}
        onConfirm={() => {
          if (target === null) return
          rollback.mutate(
            { order, target },
            {
              onSuccess: () => {
                setTarget(null)
                onRolledBack()
              },
            },
          )
        }}
      />
    </>
  )
}
