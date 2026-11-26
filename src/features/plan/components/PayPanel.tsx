import { useState } from 'react'
import { BottomSheet, Button, Input } from '../../../components/ui'
import { formatINR } from '../../../lib/money'
import { useUpiQr } from '../../../lib/useUpiQr'
import { useCancelRequest, useRequestSubscription } from '../hooks/usePlan'
import { planPayLink, TIER_LABEL, UTR_PATTERN, type Plan, type PlanLimit } from '../schemas'

/** Said wherever a plan payment is shown: nothing is automatic. */
const MANUAL_NOTE =
  'Payments are checked by hand, usually within a day. Your plan starts after approval. Keep your payment screenshot.'

/** Pay for a plan by UPI, then tell us ("I have paid"). `limit` null = closed. */
export function PayPanel(props: { plan: Plan; limit: PlanLimit | null; onClose: () => void }) {
  const { plan, limit, onClose } = props
  const [utr, setUtr] = useState('')
  const request = useRequestSubscription()
  const link = limit ? planPayLink(plan, limit) : null
  const qr = useUpiQr(link)
  const utrError =
    utr.trim() !== '' && !UTR_PATTERN.test(utr.trim()) ? 'Use 6 to 30 letters or digits' : undefined

  const title = limit ? `Pay for ${TIER_LABEL[limit.tier]}` : ''
  return (
    <BottomSheet open={limit !== null} onClose={onClose} title={title}>
      {limit && !link && (
        <p className="text-sm">
          Payments are not set up yet.
          {plan.pay_to?.support_email ? ` Please write to ${plan.pay_to.support_email}.` : ' Please try again later.'}
        </p>
      )}
      {limit && link && limit.tier !== 'trial' && (
        <div className="flex flex-col gap-3">
          <p className="text-center font-display text-2xl tabular-nums">{formatINR(limit.price_paise)}</p>
          {qr.data && (
            // White quiet zone keeps the code scannable.
            <div className="mx-auto rounded-2xl bg-white p-3">
              <img
                src={qr.data}
                alt={`QR code to pay ${formatINR(limit.price_paise)}`}
                className="h-48 w-48"
              />
            </div>
          )}
          <a
            href={link}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-fg"
          >
            Open UPI app to pay
          </a>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">Pay to</dt>
            <dd className="break-all">
              {plan.pay_to?.upi_id} ({plan.pay_to?.payee_name})
            </dd>
            <dt className="text-muted">Reference</dt>
            <dd>{plan.pay_ref}</dd>
          </dl>
          <p className="text-sm text-muted">{MANUAL_NOTE}</p>
          <Input
            label="Transaction reference (UTR), optional"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            error={utrError}
            autoCapitalize="characters"
          />
          <Button
            block
            disabled={request.isPending || utrError !== undefined}
            onClick={() =>
              request.mutate(
                { tier: limit.tier === 'pro' ? 'pro' : 'base', utr: utr.trim() },
                { onSuccess: onClose },
              )
            }
          >
            {request.isPending ? 'Sending…' : 'I have paid'}
          </Button>
        </div>
      )}
    </BottomSheet>
  )
}

/** What happened to the shop's latest payment request (nothing to show once approved). */
export function RequestStatus({ plan }: { plan: Plan }) {
  const cancel = useCancelRequest()
  const r = plan.request
  if (r?.status === 'pending') {
    return (
      <section role="status" className="flex flex-col gap-2 rounded-2xl bg-ochre p-4 text-text">
        <p className="font-medium">
          {formatINR(r.amount_paise)} for {TIER_LABEL[r.tier]} is waiting for approval.
        </p>
        <p className="text-sm">
          Reference {plan.pay_ref}
          {r.utr ? ` · UTR ${r.utr}` : ''}. {MANUAL_NOTE}
        </p>
        <Button variant="secondary" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
          {cancel.isPending ? 'Cancelling…' : 'I did not pay: cancel this'}
        </Button>
      </section>
    )
  }
  if (r?.status === 'rejected') {
    return (
      <section role="status" className="rounded-2xl bg-danger-soft p-4 text-danger-ink">
        <p className="font-medium">Your payment for {TIER_LABEL[r.tier]} was not approved.</p>
        <p className="text-sm">{r.reject_reason}</p>
      </section>
    )
  }
  return null
}
