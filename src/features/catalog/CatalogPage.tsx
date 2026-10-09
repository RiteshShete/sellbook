import { ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Page } from '../../app/Page'
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { pluralize } from '../../lib/format'
import { formatMeasure } from '../../lib/measure'
import { formatINR } from '../../lib/money'
import { useProducts } from './hooks/useCatalog'
import type { Product, Variant } from './schemas'

/**
 * Outlined, in the header: deliberately unlike the filled floating "New order" button on Home
 * and Delivery, so adding a product is never mistaken for taking an order.
 */
const addLink =
  'inline-flex min-h-11 items-center gap-1 rounded-xl border border-text bg-surface px-4 text-sm font-semibold text-text active:bg-surface-2'

function VariantChip({ variant: v }: { variant: Variant }) {
  const size =
    v.size_unit && v.size_amount !== null ? formatMeasure(v.size_unit, v.size_amount) : null
  // Skip the size when the name already says it ("1 kg" named "1 kg").
  const showSize = size !== null && size.replace(/\s/g, '') !== v.name.replace(/\s/g, '')
  return (
    <li
      className={`inline-flex items-baseline gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-sm ${v.is_active ? '' : 'text-muted line-through'}`}
    >
      <span>{v.name}</span>
      {showSize && <span className="text-muted">{size}</span>}
      <span className="font-semibold tabular-nums">{formatINR(v.price)}</span>
    </li>
  )
}

function ProductCard({ product: p }: { product: Product }) {
  return (
    <li>
      <Link
        to={`/catalog/${p.id}`}
        className={`flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 ${p.is_active ? '' : 'opacity-60'}`}
      >
        <div className="flex items-center gap-2">
          <span className="font-display min-w-0 flex-1 truncate text-xl">{p.name}</span>
          {!p.is_active && <Badge>Hidden</Badge>}
          <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
        </div>
        {p.variants.length === 0 ? (
          <p className="text-sm text-muted">No variants yet. Tap to add sizes and prices.</p>
        ) : (
          <ul
            className="flex flex-wrap gap-1.5"
            aria-label={pluralize(p.variants.length, 'variant')}
          >
            {p.variants.map((v) => (
              <VariantChip key={v.id} variant={v} />
            ))}
          </ul>
        )}
      </Link>
    </li>
  )
}

export function CatalogPage() {
  const products = useProducts()

  const addButton = (
    <Link to="/catalog/new" className={addLink}>
      <Plus className="h-5 w-5" /> Add product
    </Link>
  )

  return (
    <Page title="Products" action={addButton}>
      {products.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => void products.refetch()} />
      ) : products.data.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add the things you sell, with a price for each size or flavour."
          action={addButton}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            {pluralize(products.data.length, 'product')}. Tap one to change prices or sizes.
          </p>
          <ul className="flex flex-col gap-3">
            {products.data.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ul>
        </div>
      )}
    </Page>
  )
}
