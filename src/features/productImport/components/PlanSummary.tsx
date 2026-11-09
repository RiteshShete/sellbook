import type { ImportCounts } from '../planImport'

/** Summary chips: how much will be created, updated, skipped, and what needs attention. */
export function PlanSummary({ counts: c }: { counts: ImportCounts }) {
  const items: [number, string][] = [
    [c.products, 'products to create'],
    [c.variants, 'variants to create'],
    [c.categories, 'categories to create'],
    [c.updates, 'prices to update'],
    [c.skipped, 'skipped'],
    [c.errorRows, 'errors'],
    [c.warnings, 'warnings'],
  ]
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Import summary">
      {items.map(([n, label]) => (
        <li
          key={label}
          className="rounded-full border border-border-strong bg-surface px-3 py-1 text-sm tabular-nums"
        >
          <strong className="font-semibold">{n}</strong> {label}
        </li>
      ))}
    </ul>
  )
}
