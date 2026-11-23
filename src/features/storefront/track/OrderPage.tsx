import { Copy, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { Button, ConfirmDialog, ErrorState, Skeleton, toast } from '../../../components/ui'
import { formatDate, formatDateTime } from '../../../lib/dates'
import { formatINR, paiseToDecimalString } from '../../../lib/money'
import { toWaMeLink } from '../../../lib/phone'
import { useAuth } from '../../auth/useAuth'
import { useCancelOrder, useStoreOrder } from '../hooks/useStore'
import { t } from '../i18n'
import { storefrontPath } from '../paths'
import { StoreShell } from '../StorefrontLayout'
import { StatusTimeline } from './StatusTimeline'

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(t('order.copied')), () => toast.error(t('order.copyFailed')))
}

/** /<shop>/orders/<id>: where the order is, what is in it, and (for UPI) what to pay. Checked again every 20 seconds. */
export function OrderPage() {
  const { slug = '', orderId = '' } = useParams()
  const location = useLocation()
  const { status } = useAuth()
  const order = useStoreOrder(orderId)
  const cancel = useCancelOrder(slug)
  const [asking, setAsking] = useState(false)

  if (status === 'signedOut') return <Navigate to={storefrontPath(slug, 'login')} replace state={{ from: location.pathname }} />
  if (order.isPending) return <Skeleton className="m-4 h-72" />
  if (order.isError) return <div className="p-4"><ErrorState error={order.error} onRetry={() => void order.refetch()} /></div>
  const o = order.data
  const wa = o.shop.whatsapp ? toWaMeLink(o.shop.whatsapp, t('order.waText', { no: o.order_no, total: formatINR(o.total), shop: o.shop.name })) : null
  const canCancel = o.confirmation_status === 'pending' && o.payment_claim_status === 'none' && o.status === 'new'
  const unpaidUpi = o.payment.method === 'upi' && o.payment_status === 'pending' && o.payment.upi_id !== null

  return (
    <StoreShell title={t('order.no', { no: o.order_no })}>
      <p className="text-sm text-muted">{formatDateTime(o.created_at)}</p>
      <StatusTimeline order={o} />
      {o.decline_reason && <p className="rounded-xl bg-surface-2 p-3">{o.decline_reason}</p>}
      <section aria-label={t('order.items')}>
        <ul className="divide-y divide-border">
          {o.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-3 py-2">
              <span className="min-w-0 break-words">{i.qty} × {i.product_name}{i.variant_name ? ` · ${i.variant_name}` : ''}</span>
              <span>{formatINR(i.unit_price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt>{t('cart.subtotal')}</dt><dd className="text-right">{formatINR(o.breakdown.subtotal)}</dd>
          {o.breakdown.offer_savings > 0 && (<><dt className="text-success-ink">{t('cart.savings')}</dt><dd className="text-right text-success-ink">{formatINR(o.breakdown.offer_savings)}</dd></>)}
          <dt>{t('cart.delivery')}</dt><dd className="text-right">{o.breakdown.delivery_fee === 0 ? t('cart.free') : formatINR(o.breakdown.delivery_fee)}</dd>
          <dt className="border-t border-border pt-2 font-medium">{t('cart.total')}</dt><dd className="border-t border-border pt-2 text-right font-medium">{formatINR(o.total)}</dd>
        </dl>
      </section>
      <section className="text-sm">
        <p><span className="text-muted">{t('order.when')}</span> {o.requested_for ? formatDate(o.requested_for) : '-'}</p>
        <p><span className="text-muted">{o.fulfilment === 'delivery' ? t('checkout.delivery') : t('checkout.pickup')}</span>{o.address ? `: ${[o.address.line1, o.address.city, o.address.pincode].join(', ')}` : ''}</p>
        <p><span className="text-muted">{t('checkout.payment')}</span> {o.payment.method === 'upi' ? t('checkout.payUpi') : t('checkout.payCod')} · {o.payment_status === 'paid' ? t('order.paid') : t('order.unpaid')}</p>
      </section>
      {unpaidUpi && (
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4" aria-label={t('order.payTitle')}>
          <h2 className="font-medium">{t('order.payTitle')}</h2>
          <p className="text-sm">{t('order.payBody', { amount: formatINR(o.total), payee: o.payment.payee_name ?? '' })}</p>
          <Button variant="secondary" onClick={() => copy(o.payment.upi_id ?? '')}><Copy className="h-5 w-5" /> {t('order.copyUpi')}: {o.payment.upi_id}</Button>
          <Button variant="secondary" onClick={() => copy(paiseToDecimalString(o.total))}><Copy className="h-5 w-5" /> {t('order.copyAmount')}</Button>
        </section>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong px-4 font-medium">
          <MessageCircle className="h-5 w-5" aria-hidden /> {t('order.messageShop')}
        </a>
      )}
      {canCancel && <Button variant="ghost" className="text-danger-ink" onClick={() => setAsking(true)}>{t('order.cancel')}</Button>}
      <Link to={storefrontPath(slug, 'orders')} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">{t('orders.title')}</Link>
      <ConfirmDialog
        open={asking}
        title={t('order.cancelTitle')}
        message={t('order.cancelBody')}
        confirmLabel={t('order.cancel')}
        destructive
        busy={cancel.isPending}
        onConfirm={() => cancel.mutate(o.id, { onSuccess: () => setAsking(false) })}
        onCancel={() => setAsking(false)}
      />
    </StoreShell>
  )
}
