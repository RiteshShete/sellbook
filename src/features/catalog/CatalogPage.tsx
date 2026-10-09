import { ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Page } from '../../app/Page'
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { formatINR } from '../../lib/money'
import { useProducts } from './hooks/useCatalog'
import type { Product } from './schemas'

const linkBtn =
  'inline-flex min-h-11 items-center gap-1 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-fg'

function variantSummary(p: Product): string {
  if (p.variants.length === 0) return 'No variants yet'
  return p.variants.map((v) => `${v.name} ${formatINR(v.price)}`).join(' · ')
}

function ProductRow({ product }: { product: Product }) {
  return (
    <li>
      <Link to={`/catalog/${product.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{product.name}</span>
            {!product.is_active && <Badge>Inactive</Badge>}
          </div>
          <p className="truncate text-sm text-muted">{variantSummary(product)}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
      </Link>
    </li>
  )
}

export function CatalogPage() {
  const products = useProducts()

  const addButton = (
    <Link to="/catalog/new" className={linkBtn}>
      <Plus className="h-5 w-5" /> Add
    </Link>
  )

  return (
    <Page title="Catalog" action={addButton}>
      {products.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
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
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {products.data.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </ul>
      )}
    </Page>
  )
}
