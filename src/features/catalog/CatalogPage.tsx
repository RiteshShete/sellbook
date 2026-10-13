import { Plus, Tags } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Page } from '../../app/Page'
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { pluralize } from '../../lib/format'
import { ProductCard } from './components/ProductCard'
import { ProductFilters, ProductGrid, sectionTitle } from './components/ProductGrid'
import { useProductBrowser } from './hooks/useProductBrowser'

/**
 * Outlined, in the header: deliberately unlike the filled floating "New order" button on Home
 * and Delivery, so adding a product is never mistaken for taking an order.
 */
const addLink =
  'inline-flex min-h-11 items-center gap-1 rounded-xl border border-text bg-surface px-4 text-sm font-semibold text-text active:bg-surface-2'

export function CatalogPage() {
  const b = useProductBrowser()

  const addButton = (
    <Link to="/catalog/new" className={addLink}>
      <Plus className="h-5 w-5" /> Add product
    </Link>
  )

  return (
    <Page title="Products" action={addButton}>
      {b.products.isPending ? (
        <div className="grid grid-cols-2 gap-3" role="status" aria-label="Loading">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : b.products.isError ? (
        <ErrorState error={b.products.error} onRetry={() => void b.products.refetch()} />
      ) : b.all.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add the things you sell, with a price for each size or flavour."
          action={addButton}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <ProductFilters
            query={b.query}
            onQuery={b.setQuery}
            filter={b.filter}
            onFilter={b.setFilter}
            categories={b.categories}
            showUncategorised={b.showUncategorised}
          />
          <div className="flex items-center justify-between gap-2 text-sm text-muted">
            <p>{pluralize(b.all.length, 'product')}. Tap one to change prices or sizes.</p>
            <Link
              to="/catalog/categories"
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 font-medium text-text underline underline-offset-4"
            >
              <Tags className="h-4 w-4" /> Categories
            </Link>
          </div>
          {b.sections.length === 0 ? (
            <EmptyState title="No products match" description="Try a different word or category." />
          ) : (
            b.sections.map((s) => (
              <section key={s.category?.id ?? 'none'} className="flex flex-col gap-2">
                {b.categories.length > 0 && (
                  <h2 className="font-display text-xl">{sectionTitle(s)}</h2>
                )}
                <ProductGrid>
                  {s.products.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      to={`/catalog/${p.id}`}
                      extra={
                        !p.is_active ? (
                          <span className="mt-1">
                            <Badge>Hidden</Badge>
                          </span>
                        ) : undefined
                      }
                    />
                  ))}
                </ProductGrid>
              </section>
            ))
          )}
        </div>
      )}
    </Page>
  )
}
