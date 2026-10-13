import { Package, ReceiptText, Tag, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, ErrorState, Skeleton } from '../../../components/ui'
import { dayLabel, formatDateTime, isoDay } from '../../../lib/dates'
import type { ActivityTab, AuditRow } from '../api/activityApi'
import { describeActivity, type ActivityKind, type ActivityLine } from '../describe'
import { useActivityFeed } from '../hooks'

const ICONS: Record<ActivityKind, LucideIcon> = {
  order: ReceiptText,
  product: Package,
  variant: Tag,
}

export interface Entry {
  id: number
  at: string
  line: ActivityLine
}

function toEntries(rows: AuditRow[]): Entry[] {
  const out: Entry[] = []
  for (const r of rows) {
    const line = describeActivity(r)
    if (line) out.push({ id: r.id, at: r.created_at, line })
  }
  return out
}

/** Groups newest-first entries by IST day, keeping their order. */
export function groupByDay(entries: Entry[]): { day: string; items: Entry[] }[] {
  const groups: { day: string; items: Entry[] }[] = []
  for (const e of entries) {
    const day = isoDay(e.at)
    const last = groups.at(-1)
    if (last?.day === day) last.items.push(e)
    else groups.push({ day, items: [e] })
  }
  return groups
}

function EntryRow({ entry, showHeading }: { entry: Entry; showHeading: boolean }) {
  const { line } = entry
  const Icon = ICONS[line.kind]
  const body = (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
      <div className="min-w-0 flex-1">
        {showHeading && <p className="truncate font-medium">{line.heading}</p>}
        <p className={showHeading ? 'text-body' : 'font-medium'}>{line.text}</p>
        <p className="text-xs text-muted">{formatDateTime(entry.at)}</p>
      </div>
    </div>
  )
  return showHeading && line.entityId ? (
    <Link to={`/activity/${line.kind}/${line.entityId}`} className="block active:bg-surface-2">
      {body}
    </Link>
  ) : (
    body
  )
}

/**
 * Plain-language feed grouped by day. `entityId` narrows it to one order / product / variant
 * (its log); without it every change is shown, each row opening that thing's log.
 */
export function ActivityFeed({ tab, entityId }: { tab: ActivityTab; entityId: string | null }) {
  const feed = useActivityFeed(tab, entityId)
  const entries = toEntries(feed.data?.pages.flat() ?? [])

  if (feed.isPending) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="Loading">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }
  if (feed.isError) return <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
  if (entries.length === 0) {
    return <EmptyState title="Nothing here yet" description="Changes you make will show up here." />
  }

  return (
    <div className="flex flex-col gap-4">
      {groupByDay(entries).map((g) => (
        <section key={g.day} aria-label={dayLabel(g.day)}>
          <h2 className="mb-2 text-sm font-medium text-muted">{dayLabel(g.day)}</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface text-sm">
            {g.items.map((e) => (
              <li key={e.id}>
                <EntryRow entry={e} showHeading={entityId === null} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {feed.hasNextPage && (
        <Button
          variant="secondary"
          disabled={feed.isFetchingNextPage}
          onClick={() => void feed.fetchNextPage()}
        >
          {feed.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
