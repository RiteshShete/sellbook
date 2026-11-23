import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, ErrorState, Skeleton, toast } from '../../../components/ui'
import { useCart } from '../cart/useCart'
import { CartBar } from '../browse/CartBar'
import { ShopNotFound } from '../components/ShopNotFound'
import { VegMark } from '../components/VegMark'
import { useStoreCatalog, useStoreShop } from '../hooks/useStore'
import { t } from '../i18n'
import { storefrontPath } from '../paths'
import { PhotoCarousel } from './PhotoCarousel'
import { VariantPicker } from './VariantPicker'

const NUTRITION_LABELS: Record<string, string> = {
  energy_kcal: 'Energy (kcal)', protein_g: 'Protein (g)', carbs_g: 'Carbohydrates (g)', sugars_g: 'Sugars (g)',
  fat_g: 'Fat (g)', fibre_g: 'Fibre (g)', sodium_mg: 'Sodium (mg)',
}

/** /<shop>/products/<id>: pictures, description, details, choose an option and a quantity, add to cart. */
export function StoreProductPage() {
  const { slug = '', productId = '' } = useParams()
  const shop = useStoreShop(slug)
  const catalog = useStoreCatalog(slug)
  const { add } = useCart(slug)
  const [chosen, setChosen] = useState<string | null>(null)
  const [qty, setQty] = useState(1)

  if (shop.isPending || catalog.isPending) return <Skeleton className="m-4 h-72" />
  if (shop.isError || catalog.isError) {
    return <div className="p-4"><ErrorState error={shop.error ?? catalog.error} onRetry={() => void Promise.all([shop.refetch(), catalog.refetch()])} /></div>
  }
  if (!shop.data || !catalog.data) return <ShopNotFound />
  const product = catalog.data.products.find((p) => p.id === productId)
  if (!product) {
    return (
      <main className="mx-auto max-w-sm px-6 py-8">
        <p className="mb-3">{t('product.notFound')}</p>
        <Link to={storefrontPath(slug)} className="font-medium underline underline-offset-4">{t('shop.back')}</Link>
      </main>
    )
  }

  // One variant: no choice to make. Several: the customer picks.
  const variantId = chosen ?? (product.variants.length === 1 ? (product.variants[0]?.id ?? null) : null)
  const variant = product.variants.find((v) => v.id === variantId)
  const nutrition = Object.entries(product.nutrition ?? {})

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-28 pt-4">
      <PhotoCarousel paths={product.image_paths} name={product.name} />
      <div className="flex items-start justify-between gap-2">
        <h1 className="font-display text-2xl">{product.name}</h1>
        <VegMark type={product.veg_type} showText />
      </div>
      {product.description && <p className="whitespace-pre-line">{product.description}</p>}

      {product.is_available ? (
        <>
          {product.variants.length > 1 && <VariantPicker variants={product.variants} value={variantId} onChange={setChosen} />}
          <div className="flex items-center gap-3" role="group" aria-label={t('product.quantity')}>
            <button type="button" aria-label={t('product.less')} className="grid h-11 w-11 place-items-center rounded-full border border-border-strong" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="h-5 w-5" /></button>
            <span className="w-8 text-center text-lg tabular-nums" aria-live="polite">{qty}</span>
            <button type="button" aria-label={t('product.more')} className="grid h-11 w-11 place-items-center rounded-full border border-border-strong" onClick={() => setQty((q) => Math.min(50, q + 1))}><Plus className="h-5 w-5" /></button>
          </div>
          <Button
            block
            disabled={!variant}
            onClick={() => {
              if (!variant) return
              add(variant.id, variant.effective_price, qty)
              toast.success(t('product.added'))
              setQty(1)
            }}
          >
            {variant ? t('product.add') : t('product.chooseOption')}
          </Button>
        </>
      ) : (
        <p className="rounded-xl bg-surface-2 p-3 font-medium">{t('product.soldOut')}</p>
      )}

      {product.ingredients && <section><h2 className="font-medium">{t('product.ingredients')}</h2><p className="text-muted">{product.ingredients}</p></section>}
      {nutrition.length > 0 && (
        <section>
          <h2 className="font-medium">{t('product.nutrition')}</h2>
          <table className="mt-1 w-full text-sm"><tbody>
            {nutrition.map(([k, v]) => (<tr key={k} className="border-b border-border"><th scope="row" className="py-1 text-left font-normal text-muted">{NUTRITION_LABELS[k] ?? k}</th><td className="py-1 text-right">{v}</td></tr>))}
          </tbody></table>
        </section>
      )}
      {product.allergens.length > 0 && <section><h2 className="font-medium">{t('product.allergens')}</h2><p className="text-muted">{product.allergens.join(', ')}</p></section>}
      {product.shelf_life && <section><h2 className="font-medium">{t('product.shelfLife')}</h2><p className="text-muted">{product.shelf_life}</p></section>}
      <Link to={storefrontPath(slug)} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">{t('shop.back')}</Link>
      <CartBar slug={slug} shop={shop.data} catalog={catalog.data} />
    </main>
  )
}
