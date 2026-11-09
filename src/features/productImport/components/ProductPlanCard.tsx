import { formatINR } from '../../../lib/money'
import { Badge } from '../../../components/ui'
import type { PlanProduct, PlanVariant, VariantDiff } from '../planImport'
import { StatusChip } from './StatusChip'

function diffText(d: VariantDiff): string[] {
  const out: string[] = []
  if (d.price) out.push(`Price ${formatINR(d.price[0])} → ${formatINR(d.price[1])}`)
  if (d.cost) {
    out.push(`Cost ${d.cost[0] === null ? 'none' : formatINR(d.cost[0])} → ${formatINR(d.cost[1])}`)
  }
  if (d.active)
    out.push(`${d.active[0] ? 'Active' : 'Hidden'} → ${d.active[1] ? 'Active' : 'Hidden'}`)
  return out
}

function VariantLine({ v }: { v: PlanVariant }) {
  const label = [v.name, v.sizeLabel && v.sizeLabel !== v.name ? v.sizeLabel : ''].filter(Boolean)
  return (
    <li className="flex flex-col gap-1 border-t border-border py-2 first:border-t-0">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 break-words">{label.join(' · ')}</p>
        <p className="shrink-0 font-medium tabular-nums">
          {v.pricePaise === null ? '—' : formatINR(v.pricePaise)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs text-muted">Row {v.line}</span>
        <StatusChip status={v.status} />
        {v.flagged && <StatusChip status="check" />}
      </div>
      {v.diff && (
        <ul className="text-sm text-muted">
          {diffText(v.diff).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {v.errors.length > 0 && (
        <ul className="text-sm text-danger-ink">
          {v.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** One product with its variant lines. Long names wrap to two lines; no horizontal scrolling. */
export function ProductPlanCard({ product: p }: { product: PlanProduct }) {
  return (
    <li className="min-w-0 rounded-2xl border border-border bg-surface p-4">
      <h3 className="font-display line-clamp-2 text-lg leading-snug break-words">{p.name}</h3>
      <div className="mt-1 flex flex-wrap gap-1">
        <Badge>{p.categoryName ?? 'Uncategorised'}</Badge>
        {p.newCategory && <Badge kind="importNew">New category</Badge>}
        {p.willCreate && <Badge kind="importNew">New product</Badge>}
      </div>
      <ul className="mt-2">
        {p.variants.map((v) => (
          <VariantLine key={v.line} v={v} />
        ))}
      </ul>
    </li>
  )
}
