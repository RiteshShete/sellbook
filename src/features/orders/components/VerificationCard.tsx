import { useState } from 'react'
import { Button, ConfirmDialog, toast } from '../../../components/ui'
import { formatDateTime } from '../../../lib/dates'
import { formatINR } from '../../../lib/money'
import { useOrdersWithUtr, useRejectPayment, useVerifyPayment } from '../hooks/useCustomerOrders'
import type { Order } from '../schemas'
import { ReasonSheet } from './ReasonSheet'
import type { TellState } from './TellCustomerSheet'

interface Props {
  order: Order
  /** Called with what to tell the customer after the owner marks the payment received. */
  onTell: (tell: TellState) => void
  tellLink: (kind: 'paid') => string | null
}

/**
 * "The customer says they paid." The amount is shown big: the owner checks THEIR OWN bank app, never the customer's screen.
 * The app cannot see the bank; only the owner's tap marks it paid.
 */
export function VerificationCard({ order, onTell, tellLink }: Props) {
  const verify = useVerifyPayment()
  const reject = useRejectPayment()
  const others = useOrdersWithUtr(order)
  const [sure, setSure] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const busy = verify.isPending || reject.isPending || verify.blocked

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border-strong bg-surface-2 p-4" aria-label="Payment to check">
      <h3 className="font-medium">The customer says they paid</h3>
      <p className="text-3xl font-semibold tabular-nums" data-testid="claimed-amount">
        {formatINR(order.total)}
      </p>
      <p className="text-sm text-muted">
        {order.payment_reference ? `UTR ${order.payment_reference}` : 'No UTR given'}
        {order.payment_claimed_at && ` · ${formatDateTime(order.payment_claimed_at)}`}
      </p>
      {(others.data?.length ?? 0) > 0 && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger-ink">
          This UTR is already used on order {others.data?.map((n) => `#${n}`).join(', ')}. Check your bank before you accept.
        </p>
      )}
      <p className="text-sm">Look for this amount in your own bank or UPI app first.</p>
      <Button block disabled={busy} onClick={() => setSure(true)}>
        Verified, mark paid
      </Button>
      <Button variant="secondary" block disabled={busy} onClick={() => setRejecting(true)}>
        Not received
      </Button>

      <ConfirmDialog
        open={sure}
        title={`Mark ${formatINR(order.total)} as received?`}
        message="Only do this when you can see the money in your account. The customer is shown “Payment confirmed”."
        confirmLabel="Yes, I received it"
        busy={verify.isPending}
        onCancel={() => setSure(false)}
        onConfirm={() =>
          verify.mutate(order, {
            onSuccess: (duplicate) => {
              setSure(false)
              toast.success('Marked paid')
              onTell({
                title: 'Tell the customer',
                link: tellLink('paid'),
                note: duplicate !== null ? `Note: the same UTR is also on order #${duplicate}.` : undefined,
              })
            },
          })
        }
      />
      <ReasonSheet
        open={rejecting}
        title="Payment not received"
        confirmLabel="Tell the customer it was not received"
        busy={reject.isPending}
        onClose={() => setRejecting(false)}
        onSubmit={(reason) =>
          reject.mutate(
            { order, reason },
            {
              onSuccess: () => {
                setRejecting(false)
                toast.success('The customer will see that it was not received')
              },
            },
          )
        }
      />
    </section>
  )
}
