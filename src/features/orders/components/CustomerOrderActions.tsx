import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, toast } from '../../../components/ui'
import { formatDate } from '../../../lib/dates'
import { formatINR } from '../../../lib/money'
import { useSettings } from '../../settings/hooks/useSettings'
import { actionReasons, customerMessage, whatsappToCustomer, type MessageKind } from '../customerOrders'
import { useConfirmOrder, useDeclineOrder } from '../hooks/useCustomerOrders'
import type { Order } from '../schemas'
import { ConfirmSheet } from './ConfirmSheet'
import { ReasonSheet } from './ReasonSheet'
import { showTell } from './tellCustomer'
import { VerificationCard } from './VerificationCard'

/**
 * What the shop can do about a customer order right now: confirm or decline it, check a payment, or (after a decline of a paid
 * order) remember to refund. After each decision a WhatsApp message to the customer is one tap away.
 */
export function CustomerOrderActions({ order }: { order: Order }) {
  const shop = useSettings().data?.shop_name || 'our shop'
  const confirm = useConfirmOrder()
  const decline = useDeclineOrder()
  const [asking, setAsking] = useState<'confirm' | 'decline' | null>(null)
  const reasons = actionReasons(order)

  const link = (kind: MessageKind, reason?: string) =>
    whatsappToCustomer(
      order.customer_phone,
      customerMessage(kind, { name: order.customer_name, no: order.order_no, shop, total: order.total, date: order.due_date ? formatDate(order.due_date) : undefined, reason }),
    )

  if (reasons.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      {reasons.includes('confirm') && (
        <div className="flex flex-col gap-2">
          <Button block disabled={confirm.blocked} onClick={() => setAsking('confirm')}>
            Confirm order
          </Button>
          <Button variant="secondary" block disabled={decline.blocked} onClick={() => setAsking('decline')}>
            Decline
          </Button>
        </div>
      )}
      {reasons.includes('verify') && <VerificationCard order={order} onTell={showTell} tellLink={() => link('paid')} />}
      {reasons.includes('refund') && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger-ink">
          This order was declined after {formatINR(order.total)} was {order.payment_status === 'paid' ? 'paid' : 'claimed'}. Refund the customer by hand, then{' '}
          <Link to={`/orders/${order.id}`} className="font-medium underline">
            set the payment back to pending
          </Link>{' '}
          so this reminder goes away.
        </p>
      )}

      <ConfirmSheet
        open={asking === 'confirm'}
        busy={confirm.isPending}
        onClose={() => setAsking(null)}
        onConfirm={(note) =>
          confirm.mutate(
            { order, note },
            {
              onSuccess: () => {
                setAsking(null)
                toast.success('Order confirmed')
                showTell({ title: 'Tell the customer', link: link('confirmed') })
              },
            },
          )
        }
      />
      <ReasonSheet
        open={asking === 'decline'}
        title="Decline this order"
        confirmLabel="Decline order"
        quick
        busy={decline.isPending}
        onClose={() => setAsking(null)}
        onSubmit={(reason) =>
          decline.mutate(
            { order, reason },
            {
              onSuccess: (refundNeeded) => {
                setAsking(null)
                showTell({
                  title: 'Tell the customer',
                  link: link('declined', reason),
                  note: refundNeeded ? 'This order was already paid or claimed: remember to refund the customer by hand.' : undefined,
                })
              },
            },
          )
        }
      />
    </div>
  )
}
