import { useQuery } from '@tanstack/react-query'
import { Copy, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { Button, ConfirmDialog, toast } from '../../../components/ui'
import { formatINR, paiseToDecimalString } from '../../../lib/money'
import { upiQrDataUrl } from '../../../lib/qrImage'
import { queryKeys } from '../../../lib/queryKeys'
import { buildUpiUri, orderUpiNote } from '../../../lib/upi'
import { usePaymentActions, useStoreShop } from '../hooks/useStore'
import { t } from '../i18n'
import type { CustomerOrder } from '../types'
import { ClaimSheet } from './ClaimSheet'
import { paymentView } from './paymentView'

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(t('order.copied')), () => toast.error(t('order.copyFailed')))
}

const box = 'flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4'

/** The UPI deep link for exactly the order total, or null when it cannot be built (then the manual way is shown). */
function upiLink(o: CustomerOrder): string | null {
  if (o.payment.upi_id === null || o.payment.payee_name === null) return null
  try {
    return buildUpiUri({ vpa: o.payment.upi_id, payeeName: o.payment.payee_name, amount: o.total, note: orderUpiNote(o.order_no, o.shop.name) })
  } catch {
    return null
  }
}

/**
 * Where the customer pays and tells the shop. The app never sees the bank: "I have paid" only files a claim, and the
 * shop owner confirms it after checking their own account. The copy-the-UPI-ID path always works, even when a UPI app
 * refuses a prefilled link.
 */
export function PaymentPanel({ order, slug }: { order: CustomerOrder; slug: string }) {
  const view = paymentView(order)
  const shop = useStoreShop(slug)
  const { claim, cod } = usePaymentActions(slug, order.id)
  const [telling, setTelling] = useState(false)
  const [switching, setSwitching] = useState(false)
  const link = view === 'pay' || view === 'rejected' ? upiLink(order) : null
  const qr = useQuery({ queryKey: queryKeys.upiQr(link ?? ''), queryFn: () => upiQrDataUrl(link ?? ''), enabled: link !== null, staleTime: Infinity })
  const amount = formatINR(order.total)

  if (view === 'none') return null
  if (view === 'paid') {
    return (
      <section className={box} aria-label={t('pay.title')}>
        <h2 className="font-medium text-success-ink">{t('pay.confirmed')}</h2>
        <p>{t('pay.confirmedBody', { amount })}</p>
      </section>
    )
  }
  if (view === 'cod') {
    return (
      <section className={box} aria-label={t('pay.title')}>
        <h2 className="font-medium">{t('pay.cod')}</h2>
        <p>{t('pay.codBody', { amount })}</p>
      </section>
    )
  }
  if (view === 'waiting') {
    return (
      <section className={box} aria-label={t('pay.title')} role="status">
        <h2 className="font-medium">{t('pay.waiting')}</h2>
        <p className="text-sm text-muted">{t('pay.waitingBody')}</p>
      </section>
    )
  }

  const canClaim = view !== 'limit'
  return (
    <section className={box} aria-label={t('pay.title')}>
      {view === 'rejected' && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger-ink">
          <span className="font-medium">{t('pay.rejected')}.</span> {t('pay.rejectedBody', { reason: order.payment_reject_reason ?? '' })}
        </p>
      )}
      <h2 className="font-medium">{t('pay.amount')}</h2>
      <p className="text-3xl font-semibold tabular-nums">{amount}</p>
      {order.payment.payee_name && <p className="text-sm text-muted">{t('pay.to', { payee: order.payment.payee_name })}</p>}
      {link && (
        <a href={link} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-fg">
          <Smartphone className="h-5 w-5" aria-hidden /> {t('pay.upiApp')}
        </a>
      )}
      <Button variant="secondary" onClick={() => copy(order.payment.upi_id ?? '')}>
        <Copy className="h-5 w-5" /> {t('pay.copyUpi')}: {order.payment.upi_id}
      </Button>
      <Button variant="secondary" onClick={() => copy(paiseToDecimalString(order.total))}>
        <Copy className="h-5 w-5" /> {t('pay.copyAmount')}
      </Button>
      {qr.data && (
        <figure className="flex flex-col items-center gap-1">
          <img src={qr.data} alt={t('pay.qrAlt', { amount })} width={200} height={200} className="rounded-xl border border-border bg-white" />
          <figcaption className="text-sm text-muted">{t('pay.qrHint')}</figcaption>
        </figure>
      )}
      <p className="text-sm text-muted">{t('pay.manual', { amount })}</p>
      <p className="text-sm text-muted">{t('pay.honest')}</p>
      {canClaim ? (
        <Button block onClick={() => setTelling(true)}>{view === 'rejected' ? t('pay.tryAgain') : t('pay.paid')}</Button>
      ) : (
        <p role="alert" className="text-sm text-danger-ink">{t('pay.limit')}</p>
      )}
      {view !== 'pay' && shop.data?.pay_cod && (
        <Button variant="secondary" block onClick={() => setSwitching(true)}>{t('pay.codInstead')}</Button>
      )}
      <ClaimSheet
        open={telling}
        busy={claim.isPending}
        onClose={() => setTelling(false)}
        onSend={(utr) => claim.mutate(utr, { onSuccess: () => setTelling(false) })}
      />
      <ConfirmDialog
        open={switching}
        title={t('pay.codInsteadTitle')}
        message={t('pay.codInsteadBody')}
        confirmLabel={t('pay.codInstead')}
        busy={cod.isPending}
        onCancel={() => setSwitching(false)}
        onConfirm={() => cod.mutate(undefined, { onSuccess: () => setSwitching(false) })}
      />
    </section>
  )
}
