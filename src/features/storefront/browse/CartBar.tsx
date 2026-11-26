import { ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatINR } from '../../../lib/money'
import { cartCount } from '../cart/cartStore'
import { estimateTotals, priceCart } from '../cart/priceCart'
import { useCart } from '../cart/useCart'
import { t } from '../i18n'
import { storefrontPath } from '../paths'
import type { StoreCatalog, StoreShop } from '../types'

/** The sticky "View cart" bar: item count and the estimated total (delivery counted as for delivery). */
export function CartBar({ slug, shop, catalog }: { slug: string; shop: StoreShop; catalog: StoreCatalog }) {
  const { cart } = useCart(slug)
  const count = cartCount(cart)
  if (count === 0) return null
  const total = estimateTotals(priceCart(cart, catalog), shop, 'delivery').total
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <Link
        to={storefrontPath(slug, 'cart')}
        className="mx-auto flex min-h-12 max-w-2xl items-center justify-between rounded-xl bg-primary px-4 font-medium text-primary-fg"
      >
        <span className="inline-flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" aria-hidden /> {t('cart.view')} · {t('cart.items', { n: count })}
        </span>
        <span>{formatINR(total)}</span>
      </Link>
    </div>
  )
}
