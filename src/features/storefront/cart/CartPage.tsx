import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, EmptyState, ErrorState, Skeleton } from '../../../components/ui'
import { formatINR } from '../../../lib/money'
import { ShopNotFound } from '../components/ShopNotFound'
import { fulfilmentOptions } from '../checkout/validate'
import { useStoreCatalog, useStoreShop } from '../hooks/useStore'
import { t } from '../i18n'
import { storefrontPath } from '../paths'
import { CartLineRow } from './CartLineRow'
import { CartTotals } from './CartTotals'
import { estimateTotals, priceCart } from './priceCart'
import { useCart } from './useCart'

/** /<shop>/cart: what is in the cart, with what changed since it was added, and the estimated total. */
export function CartPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const shop = useStoreShop(slug)
  const catalog = useStoreCatalog(slug)
  const { cart, set, remove } = useCart(slug)

  if (shop.isPending || catalog.isPending) return <Skeleton className="m-4 h-60" />
  if (shop.isError || catalog.isError) {
    return <div className="p-4"><ErrorState error={shop.error ?? catalog.error} onRetry={() => void Promise.all([shop.refetch(), catalog.refetch()])} /></div>
  }
  if (!shop.data || !catalog.data) return <ShopNotFound />
  if (cart.lines.length === 0) {
    return (
      <EmptyState
        title={t('cart.empty')}
        description={t('cart.emptyBody')}
        action={<Link to={storefrontPath(slug)} className="font-medium underline underline-offset-4">{t('shop.back')}</Link>}
      />
    )
  }

  const lines = priceCart(cart, catalog.data)
  const fulfilment = fulfilmentOptions(shop.data)[0] ?? 'delivery'
  const totals = estimateTotals(lines, shop.data, fulfilment)
  const unavailable = lines.filter((l) => l.status === 'unavailable')
  const free = shop.data.free_delivery_above
  const toFree = free !== null && fulfilment === 'delivery' && totals.subtotal < free ? free - totals.subtotal : 0
  const toMin = totals.belowMinimum ? shop.data.min_order - totals.subtotal : 0
  const blocked = !shop.data.accepts_orders || unavailable.length > 0 || totals.belowMinimum

  function proceed() {
    // The customer has now seen the new prices: remember them, so "price updated" is not shown twice.
    for (const l of lines) if (l.status === 'priceChanged') set(l.variantId, l.qty, l.unitPrice)
    void navigate(storefrontPath(slug, 'checkout'))
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4">
      <h1 className="font-display text-3xl">{t('cart.title')}</h1>
      <ul className="divide-y divide-border">
        {lines.map((l) => (
          <CartLineRow key={l.variantId} line={l} onQty={(q) => set(l.variantId, q, l.unitPrice)} onRemove={() => remove(l.variantId)} />
        ))}
      </ul>
      <CartTotals totals={totals} />
      <p className="text-sm text-muted">{t('cart.finalNote')}</p>
      {toFree > 0 && <p className="rounded-xl bg-info-soft px-3 py-2 text-sm text-info-ink">{t('cart.freeHint', { amount: formatINR(toFree) })}</p>}
      {toMin > 0 && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink">{t('cart.minHint', { amount: formatINR(toMin) })}</p>}
      {!shop.data.accepts_orders && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink">{t('cart.closed')}</p>}
      {unavailable.length > 0 && (
        <Button variant="secondary" block onClick={() => unavailable.forEach((l) => remove(l.variantId))}>{t('cart.removeUnavailable')}</Button>
      )}
      <Button block disabled={blocked} onClick={proceed}>{t('cart.checkout')}</Button>
      <Link to={storefrontPath(slug)} className="inline-flex min-h-11 items-center justify-center font-medium underline underline-offset-4">{t('cart.keepShopping')}</Link>
    </main>
  )
}
