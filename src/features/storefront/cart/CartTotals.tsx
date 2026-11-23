import { formatINR } from '../../../lib/money'
import type { Totals } from '../../../lib/pricing'
import { t } from '../i18n'

/** The breakdown shown on the cart and at checkout. "Estimated" until the server confirms it on placing the order. */
export function CartTotals({ totals, final = false }: { totals: Totals; final?: boolean }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
      <dt>{t('cart.subtotal')}</dt>
      <dd className="text-right">{formatINR(totals.subtotal)}</dd>
      {totals.offerSavings > 0 && (
        <>
          <dt className="text-success-ink">{t('cart.savings')}</dt>
          <dd className="text-right text-success-ink">{formatINR(totals.offerSavings)}</dd>
        </>
      )}
      <dt>{t('cart.delivery')}</dt>
      <dd className="text-right">{totals.deliveryFee === 0 ? t('cart.free') : formatINR(totals.deliveryFee)}</dd>
      <dt className="border-t border-border pt-2 font-medium">{final ? t('cart.total') : t('cart.estimated')}</dt>
      <dd className="border-t border-border pt-2 text-right font-medium">{formatINR(totals.total)}</dd>
    </dl>
  )
}
