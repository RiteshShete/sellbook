import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, Skeleton } from '../../../components/ui'
import { formatINR } from '../../../lib/money'
import { useProducts } from '../../catalog/hooks/useCatalog'
import type { PickedVariant } from '../hooks/useOrderDraft'

const chip = 'min-h-11 rounded-full border px-4 text-sm font-medium whitespace-nowrap'

/** Product chips, then variant chips; tapping a variant adds one to the order. */
export function ItemPicker({ onPick }: { onPick: (v: PickedVariant) => void }) {
  const products = useProducts()
  const [selected, setSelected] = useState<string | null>(null)

  if (products.isPending) return <Skeleton className="h-24 w-full" />
  if (products.isError) {
    return <ErrorState error={products.error} onRetry={() => void products.refetch()} />
  }

  // Only what can be sold right now (B8: the server re-checks and snapshots).
  const sellable = products.data
    .filter((p) => p.is_active)
    .map((p) => ({ ...p, variants: p.variants.filter((v) => v.is_active) }))
    .filter((p) => p.variants.length > 0)

  if (sellable.length === 0) {
    return (
      <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
        No active products.{' '}
        <Link to="/catalog/new" className="font-medium text-primary">
          Add one in Catalog
        </Link>
      </p>
    )
  }

  const product = sellable.find((p) => p.id === selected) ?? sellable[0]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Products">
        {sellable.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === product?.id}
            onClick={() => setSelected(p.id)}
            className={`${chip} ${p.id === product?.id ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface'}`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {product?.variants.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() =>
              onPick({
                variant_id: v.id,
                product_name: product.name,
                variant_name: v.name,
                unit_price: v.price,
              })
            }
            className={`${chip} border-border bg-surface-2`}
          >
            + {v.name} · {formatINR(v.price)}
          </button>
        ))}
      </div>
    </div>
  )
}
