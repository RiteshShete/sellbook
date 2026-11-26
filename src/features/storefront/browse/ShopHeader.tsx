import { MessageCircle } from 'lucide-react'
import { formatINR } from '../../../lib/money'
import { toWaMeLink } from '../../../lib/phone'
import { useAuth } from '../../auth/useAuth'
import { imageUrl } from '../api/storefrontApi'
import { t } from '../i18n'
import type { StoreShop } from '../types'

/** Name, state (taking orders or not), announcement, delivery terms, WhatsApp and the FSSAI number. */
export function ShopHeader({ shop }: { shop: StoreShop }) {
  const { client } = useAuth()
  const wa = shop.whatsapp ? toWaMeLink(shop.whatsapp, `Hi ${shop.name}`) : null
  return (
    <header className="flex flex-col gap-3 px-4 pt-4">
      <div className="flex items-center gap-3">
        {shop.logo_path && (
          <img src={imageUrl(client, shop.logo_path)} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover" />
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-tight">{shop.name}</h1>
          {(shop.tagline || shop.city) && <p className="truncate text-sm text-muted">{[shop.tagline, shop.city].filter(Boolean).join(' · ')}</p>}
        </div>
      </div>
      <p
        className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-medium ${shop.accepts_orders ? 'bg-success-soft text-success-ink' : 'bg-surface-2 text-muted'}`}
      >
        {shop.accepts_orders ? t('shop.open') : (shop.closed_message ?? t('shop.closed'))}
      </p>
      {shop.banner_text && <p className="rounded-xl bg-info-soft px-3 py-2 text-sm text-info-ink">{shop.banner_text}</p>}
      <p className="text-sm text-muted">
        {[
          shop.min_order > 0 ? t('shop.minOrder', { amount: formatINR(shop.min_order) }) : null,
          shop.free_delivery_above !== null ? t('shop.freeFrom', { amount: formatINR(shop.free_delivery_above) }) : null,
          shop.delivery_note,
          shop.fssai_no ? t('shop.fssai', { no: shop.fssai_no }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-border-strong px-4 font-medium">
          <MessageCircle className="h-5 w-5" aria-hidden /> {t('shop.whatsapp')}
        </a>
      )}
    </header>
  )
}
