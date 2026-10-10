import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, Skeleton } from '../../../components/ui'
import { ProductCard } from '../../catalog/components/ProductCard'
import { ProductFilters, ProductGrid, sectionTitle } from '../../catalog/components/ProductGrid'
import { useProductBrowser } from '../../catalog/hooks/useProductBrowser'
import type { Product } from '../../catalog/schemas'
import type { OrderDraftState } from '../hooks/useOrderDraft'
import { lineQty, pickedFrom, VariantSheet } from './VariantSheet'

/** Only what can be sold right now (B8: the server re-checks and snapshots). */
const isSellable = (p: Product) => p.is_active && p.variants.some((v) => v.is_active)

/**
 * New order, step "what": search + category chips + a 2-column product grid. One sellable variant:
 * tap adds one and the card shows − / +. Several: tap opens a sheet with every variant. Never
 * scrolls sideways.
 */
export function ProductPicker({ form }: { form: OrderDraftState }) {
  const b = useProductBrowser(isSellable)
  const [open, setOpen] = useState<Product | null>(null)
  const lines = form.draft.lines

  if (b.products.isPending) {
    return (
      <div className="grid grid-cols-2 gap-3" role="status" aria-label="Loading">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (b.products.isError) {
    return <ErrorState error={b.products.error} onRetry={() => void b.products.refetch()} />
  }
  if (b.all.length === 0) {
    return (
      <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
        No active products.{' '}
        <Link to="/catalog/new" className="font-medium underline underline-offset-4">
          Add one in Products
        </Link>
      </p>
    )
  }

  const qtyOf = (p: Product) =>
    lines
      .filter((l) => p.variants.some((v) => v.id === l.variant_id))
      .reduce((n, l) => n + (Number.isSafeInteger(l.quantity) ? l.quantity : 0), 0)

  function select(p: Product) {
    const active = p.variants.filter((v) => v.is_active)
    const only = active[0]
    if (active.length === 1 && only) form.addVariant(pickedFrom(p, only))
    else setOpen(p)
  }

  return (
    <div className="flex flex-col gap-3">
      <ProductFilters
        query={b.query}
        onQuery={b.setQuery}
        filter={b.filter}
        onFilter={b.setFilter}
        categories={b.categories}
        showUncategorised={b.showUncategorised}
      />
      {b.sections.length === 0 && (
        <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">No products match.</p>
      )}
      {b.sections.map((s) => (
        <section key={s.category?.id ?? 'none'} className="flex flex-col gap-2">
          {b.categories.length > 0 && <h3 className="font-display text-lg">{sectionTitle(s)}</h3>}
          <ProductGrid>
            {s.products.map((p) => {
              const active = p.variants.filter((v) => v.is_active)
              const only = active.length === 1 ? active[0] : undefined
              return (
                <ProductCard
                  key={p.id}
                  product={{ ...p, variants: active }}
                  quantity={qtyOf(p)}
                  onSelect={() => select(p)}
                  stepper={
                    only
                      ? {
                          onMinus: () =>
                            form.setVariantQty(pickedFrom(p, only), lineQty(lines, only) - 1),
                          onPlus: () => form.addVariant(pickedFrom(p, only)),
                        }
                      : undefined
                  }
                />
              )
            })}
          </ProductGrid>
        </section>
      ))}
      <VariantSheet
        product={open}
        lines={lines}
        onSetQty={form.setVariantQty}
        onClose={() => setOpen(null)}
      />
    </div>
  )
}
