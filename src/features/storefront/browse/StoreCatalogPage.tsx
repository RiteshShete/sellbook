import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, EmptyState, ErrorState, Skeleton } from '../../../components/ui'
import { ShopNotFound } from '../components/ShopNotFound'
import { useStoreCatalog, useStoreShop } from '../hooks/useStore'
import { t } from '../i18n'
import { filterProducts, firstPages } from './catalogView'
import { CartBar } from './CartBar'
import { CatalogFilters } from './CatalogFilters'
import { ShopHeader } from './ShopHeader'
import { StoreProductCard } from './StoreProductCard'

/** /<shop>/products: the public catalogue. Loading, not found, error and empty states are all handled. */
export function StoreCatalogPage() {
  const { slug = '' } = useParams()
  const shop = useStoreShop(slug)
  const catalog = useStoreCatalog(slug)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [pages, setPages] = useState(1)

  if (shop.isPending || catalog.isPending) {
    return (
      <div className="flex flex-col gap-3 p-4" role="status" aria-label={t('loading')}>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-11 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="aspect-square" />
          <Skeleton className="aspect-square" />
        </div>
      </div>
    )
  }
  if (shop.isError || catalog.isError) {
    return (
      <div className="p-4">
        <ErrorState error={shop.error ?? catalog.error} onRetry={() => void Promise.all([shop.refetch(), catalog.refetch()])} />
      </div>
    )
  }
  if (!shop.data || !catalog.data) return <ShopNotFound />

  const matches = filterProducts(catalog.data, query, category)
  const { items: shown, more } = firstPages(matches, pages)
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 pb-24">
      <ShopHeader shop={shop.data} />
      {catalog.data.products.length === 0 ? (
        <EmptyState title={t('catalog.empty.title')} description={t('catalog.empty.body')} />
      ) : (
        <>
          <CatalogFilters catalog={catalog.data} query={query} category={category} onQuery={(q) => { setQuery(q); setPages(1) }} onCategory={(c) => { setCategory(c); setPages(1) }} />
          {matches.length === 0 ? (
            <p className="px-4 text-muted">{t('catalog.noMatch')}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 px-4">
              {shown.map((p) => (
                <StoreProductCard key={p.id} slug={slug} product={p} />
              ))}
            </ul>
          )}
          {more && (
            <div className="px-4">
              <Button variant="secondary" block onClick={() => setPages(pages + 1)}>{t('catalog.more')}</Button>
            </div>
          )}
        </>
      )}
      <CartBar slug={slug} shop={shop.data} catalog={catalog.data} />
    </main>
  )
}
