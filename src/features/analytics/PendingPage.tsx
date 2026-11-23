import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../../app/Page'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { pluralize } from '../../lib/format'
import { addMoney, formatINR } from '../../lib/money'
import { usePendingPayments } from './hooks/useAnalytics'
import { bucketLabel, summarizeBuckets, type AgeBucket, type PendingRow } from './schemas'

/** Brand card fills that warm up as payments get older (the label carries the meaning). */
const BUCKET_FILL: Record<AgeBucket, string> = {
  '0-7': 'bg-mint',
  '8-30': 'bg-ochre',
  '31-60': 'bg-peach',
  '60+': 'bg-coral',
}

/** Delivered but unpaid orders, all time, oldest first, grouped into ageing buckets. */
export function PendingPage() {
  const pending = usePendingPayments()
  const [bucket, setBucket] = useState<AgeBucket | null>(null)

  return (
    <Page title="Pending payments" back="/more">
      {pending.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : pending.isError ? (
        <ErrorState error={pending.error} onRetry={() => void pending.refetch()} />
      ) : pending.data.length === 0 ? (
        <EmptyState
          title="All paid up"
          description="Delivered orders that are not marked paid show up here."
        />
      ) : (
        <PendingList
          rows={pending.data}
          bucket={bucket}
          onBucket={(b) => setBucket((cur) => (cur === b ? null : b))}
        />
      )}
    </Page>
  )
}

function PendingList(props: {
  rows: PendingRow[]
  bucket: AgeBucket | null
  onBucket: (b: AgeBucket) => void
}) {
  const { rows, bucket, onBucket } = props
  const shown = bucket ? rows.filter((r) => r.bucket === bucket) : rows
  // Ageing is Pro: other plans get the plain list (the server sends no ages).
  const aged = rows.every((r) => r.bucket !== null)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {formatINR(addMoney(...rows.map((r) => r.total)))} across {pluralize(rows.length, 'order')}
      </p>
      {!aged && (
        <p className="text-sm text-muted">
          Grouping by age is Pro.{' '}
          <Link to="/plan" className="font-medium underline underline-offset-4">
            See plans
          </Link>
        </p>
      )}
      <div
        className={aged ? 'grid grid-cols-2 gap-2' : 'hidden'}
        role="group"
        aria-label="Filter by age"
      >
        {summarizeBuckets(rows).map((b) => (
          <button
            key={b.bucket}
            type="button"
            aria-pressed={bucket === b.bucket}
            onClick={() => onBucket(b.bucket)}
            disabled={b.count === 0}
            className={`min-h-14 rounded-2xl border-2 p-3 text-left text-text disabled:opacity-50 ${BUCKET_FILL[b.bucket]} ${bucket === b.bucket ? 'border-text' : 'border-transparent'}`}
          >
            <span className="block text-sm text-text/70">{bucketLabel(b.bucket)}</span>
            <span className="font-semibold tabular-nums">{formatINR(b.total)}</span>
            <span className="ml-1 text-sm text-text/70">· {b.count}</span>
          </button>
        ))}
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {shown.map((r) => (
          <li key={r.id}>
            <Link to={`/orders/${r.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  #{r.order_no} {r.customer_name}
                </span>
                <span className="block text-sm text-muted">
                  Delivered {formatDate(r.delivered_at)}
                  {r.age_days !== null &&
                    ` · ${r.age_days === 0 ? 'today' : `${pluralize(r.age_days, 'day')} ago`}`}
                </span>
              </span>
              <span className="font-semibold tabular-nums">{formatINR(r.total)}</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
