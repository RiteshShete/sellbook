import { formatINR } from '../../../lib/money'
import type { MonthAnalytics } from '../schemas'

/**
 * Collected this month, online vs cash: a two-part bar plus a labelled legend (amount and share),
 * so the split never depends on colour alone.
 */
export function PaymentSplit({ a }: { a: MonthAnalytics }) {
  const parts = [
    { label: 'Online', paise: a.collected_online, color: 'bg-chart-1' },
    { label: 'Cash', paise: a.collected_cash, color: 'bg-chart-2' },
  ]
  // Round online only and give cash the rest, so the two never show 51% + 50%.
  const online = a.collected === 0 ? 0 : Math.round((a.collected_online / a.collected) * 100)
  const share = (label: string) => (label === 'Online' ? online : 100 - online)

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-semibold">Collected: online vs cash</h2>
      <p className="text-sm text-muted">Payments marked paid this month</p>
      {a.collected === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing collected this month.</p>
      ) : (
        <>
          <div
            className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={parts.map((p) => `${p.label} ${share(p.label)}%`).join(', ')}
          >
            {parts
              .filter((p) => p.paise > 0)
              .map((p) => (
                <div key={p.label} className={p.color} style={{ flexGrow: p.paise }} />
              ))}
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {parts.map((p) => (
              <li key={p.label} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-sm ${p.color}`} aria-hidden />
                <span className="flex-1">{p.label}</span>
                <span className="text-muted tabular-nums">{share(p.label)}%</span>
                <span className="w-24 text-right font-medium tabular-nums">
                  {formatINR(p.paise)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
