import { Link } from 'react-router-dom'
import { formatINR } from '../../../lib/money'
import { useAuth } from '../../auth/useAuth'
import { imageUrl } from '../api/storefrontApi'
import { VegMark } from '../components/VegMark'
import { t } from '../i18n'
import { storefrontPath } from '../paths'
import type { StoreProduct } from '../types'
import { bestOffer, fromPriceOf } from './catalogView'

/** One product in the grid: picture (the small size only), name, veg mark, "from" price, offer, sold out. */
export function StoreProductCard({ slug, product }: { slug: string; product: StoreProduct }) {
  const { client } = useAuth()
  const from = fromPriceOf(product)
  const offer = bestOffer(product)
  const cover = product.image_paths[0]
  const listFrom = product.variants.length > 0 ? Math.min(...product.variants.map((v) => v.price)) : null
  return (
    <li className="min-w-0">
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
        </div>
      </Link>
    </li>
  )
}
