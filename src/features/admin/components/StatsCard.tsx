import { ErrorState, Skeleton } from '../../../components/ui'
import { formatBytes, pluralize } from '../../../lib/format'
import { FREE_DB_BYTES, FREE_STORAGE_BYTES, fillLevel } from '../adminApi'
import { useAdminStats } from '../useAdmin'

const LEVEL_TEXT = {
  ok: '',
  warn: 'Getting full: clear space or plan the move to a paid Supabase plan.',
  full: 'Full: uploads and writes will start failing.',
}

/** How many shops, and how full the free Supabase plan is (database and storage). */
export function StatsCard() {
  const stats = useAdminStats()
  if (stats.isPending) return <Skeleton className="h-32 w-full" />
  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
  const s = stats.data
  const storage = s.bill_bytes + s.asset_bytes
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
      <h2 className="font-display text-xl">Platform</h2>
      <p className="text-sm">
        {pluralize(s.shops.total, 'shop')}: {s.shops.trial} on trial, {s.shops.base} Base, {s.shops.pro} Pro,{' '}
        {s.shops.ended} ended. {pluralize(s.orders, 'order')} in total.
      </p>
      <Fill label="Database" used={s.db_bytes} cap={FREE_DB_BYTES} />
      <Fill label="File storage (bills, logos)" used={storage} cap={FREE_STORAGE_BYTES} />
    </section>
  )
}

function Fill({ label, used, cap }: { label: string; used: number; cap: number }) {
  const level = fillLevel(used, cap)
  const pct = Math.min(100, Math.round((used / cap) * 100))
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums">
          {formatBytes(used)} of {formatBytes(cap)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-1 h-2 overflow-hidden rounded-full bg-surface"
      >
        <div className={`h-full rounded-full ${level === 'ok' ? 'bg-teal' : 'bg-danger'}`} style={{ width: `${pct}%` }} />
      </div>
      {level !== 'ok' && <p className="mt-1 text-sm text-danger-ink">{LEVEL_TEXT[level]}</p>}
    </div>
  )
}
