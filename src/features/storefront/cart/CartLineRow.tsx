import { Minus, Plus, Trash2 } from 'lucide-react'
import { formatINR } from '../../../lib/money'
import { variantLabel } from '../../../lib/variants'
import { t } from '../i18n'
import type { PricedLine } from './priceCart'

interface Props {
  line: PricedLine
  onQty: (qty: number) => void
  onRemove: () => void
}

/** One cart line: name, the price now, a "price updated" or "no longer available" note, quantity buttons, remove. */
export function CartLineRow({ line, onQty, onRemove }: Props) {
  const name = line.product ? `${line.product.name} · ${line.variant ? variantLabel(line.variant) : ''}` : t('cart.gone')
  const gone = line.status === 'unavailable'
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className={`min-w-0 break-words font-medium ${gone ? 'text-muted line-through' : ''}`}>{name}</p>
        {!gone && <p className="shrink-0">{formatINR(line.unitPrice * line.qty)}</p>}
      </div>
      {line.status === 'priceChanged' && <p className="text-sm text-info-ink">{t('cart.priceUpdated')}</p>}
      {gone && <p role="alert" className="text-sm text-danger-ink">{t('cart.unavailable')}</p>}
      <div className="flex items-center gap-2">
        {!gone && (
          <>
            <button type="button" aria-label={t('cart.less', { name })} className="grid h-11 w-11 place-items-center rounded-full border border-border-strong" onClick={() => onQty(line.qty - 1)}><Minus className="h-4 w-4" /></button>
            <span className="w-8 text-center tabular-nums">{line.qty}</span>
            <button type="button" aria-label={t('cart.more', { name })} className="grid h-11 w-11 place-items-center rounded-full border border-border-strong" onClick={() => onQty(line.qty + 1)}><Plus className="h-4 w-4" /></button>
          </>
        )}
        <button type="button" className="ml-auto inline-flex min-h-11 items-center gap-1 px-2 text-sm text-danger-ink" onClick={onRemove}>
          <Trash2 className="h-4 w-4" aria-hidden /> {t('cart.remove')}
        </button>
      </div>
    </li>
  )
}
