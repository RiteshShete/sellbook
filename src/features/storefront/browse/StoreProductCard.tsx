import { Link } from 'react-router-dom'
import { toast } from '../../../components/ui'
import { formatINR } from '../../../lib/money'
import { useAuth } from '../../auth/useAuth'
import { imageUrl } from '../api/storefrontApi'
import { useCart } from '../cart/useCart'
import { VegMark } from '../components/VegMark'
import { t } from '../i18n'
import { storefrontPath } from '../paths'
import type { StoreProduct } from '../types'
import { bestOffer, fromPriceOf } from './catalogView'

/** One product in the grid: picture (the small size only), name, veg mark, "from" price, offer, sold out. */
export function StoreProductCard({ slug, product }: { slug: string; product: StoreProduct }) {
  const { client } = useAuth()
  const { add } = useCart(slug)
  // One tap only when there is nothing to choose: a single variant that can be bought.
  const only = product.is_available && product.variants.length === 1 ? product.variants[0] : undefined
  const from = fromPriceOf(product)
  const offer = bestOffer(product)
  const cover = product.image_paths[0]
  const listFrom = product.variants.length > 0 ? Math.min(...product.variants.map((v) => v.price)) : null
  return (
    <li className="relative min-w-0">
      <Link to={`${storefrontPath(slug)}/${product.id}`} className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="relative aspect-square w-full bg-surface-2">
          {cover && <img src={imageUrl(client, cover, true)} alt="" loading="lazy" width={400} height={400} className="h-full w-full object-cover" />}
          {!product.is_available && (
            <span className="absolute inset-0 grid place-items-center bg-surface/80 text-sm font-medium">{t('product.soldOut')}</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 break-words text-base font-medium leading-snug">{product.name}</h2>
            <VegMark type={product.veg_type} />
          </div>
          {from !== null && (
            <p className="text-sm">
              {t('product.from', { price: formatINR(from) })}{' '}
              {listFrom !== null && listFrom > from && <s className="text-muted">{formatINR(listFrom)}</s>}
            </p>
          )}
          {offer && (
            <p className="text-xs font-medium text-success-ink">
              {offer.label}
              {offer.hint && ` · ${offer.hint}`}
            </p>
          )}
          {only && <div className="h-11" aria-hidden />}
        </div>
      </Link>
      {only && (
        <button
          type="button"
          aria-label={t('product.quickAdd', { name: product.name })}
          onClick={() => {
            add(only.id, only.effective_price)
            toast.success(t('product.added'))
          }}
          className="absolute right-3 bottom-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-teal px-4 text-sm font-medium text-white active:opacity-80"
        >
          + {t('cart.add')}
        </button>
      )}
    </li>
  )
}
