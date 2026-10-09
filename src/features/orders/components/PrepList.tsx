import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui'
import { pluralize } from '../../../lib/format'
import { formatTotals } from '../../../lib/measure'
import { usePrepList } from '../hooks/usePrepList'
import type { PrepProduct } from '../prep'

/**
 * "To prepare": items of every New order (not yet marked Ready), summed per product and variant,
 * only for products that were ordered. Marking an order Ready takes it off the list.
 */
export function PrepList() {
  const prep = usePrepList()

  if (prep.isPending) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Loading">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }
  if (prep.isError) return <ErrorState error={prep.error} onRetry={() => void prep.refetch()} />
  if (prep.data.products.length === 0) {
    return (
      <EmptyState
        title="Nothing to prepare"
        description="Items from New orders show up here. Marking an order Ready takes it off."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        From {pluralize(prep.data.orders, 'new order')}.{' '}
        <Link to="/orders?tab=new" className="font-medium text-text underline underline-offset-4">
          See them
        </Link>
      </p>
      {prep.data.products.map((p) => (
        <ProductCard key={p.key} product={p} />
      ))}
    </div>
  )
}

function ProductCard({ product: p }: { product: PrepProduct }) {
  // e.g. "6.25 kg", "2.75 kg + 1 L", or "4 items" when nothing has a size.
  const total = formatTotals(p).join(' + ')
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex items-baseline justify-between gap-3 bg-surface-2 px-4 py-3">
        <h2 className="min-w-0 text-lg font-semibold break-words">{p.name}</h2>
        <span className="shrink-0 text-right font-display text-xl tabular-nums">{total}</span>
      </header>
      <ul className="divide-y divide-border">
        {p.variants.map((v) => {
          // Only show the amount when the variant has a size ("× 5" alone otherwise).
          const amount = v.unsized === v.quantity ? null : formatTotals({ ...v, unsized: 0 })
          return (
            <li key={v.key} className="flex min-h-12 items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1 break-words">
                {v.name}
                <span className="block text-xs text-muted">{pluralize(v.orders, 'order')}</span>
              </span>
              <span className="text-right">
                <span
                  className="block font-display text-2xl tabular-nums"
                  aria-label={`${v.quantity} needed`}
                >
                  × {v.quantity}
                </span>
                {amount && (
                  <span className="block text-sm text-muted tabular-nums">
                    {amount.join(' + ')}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
