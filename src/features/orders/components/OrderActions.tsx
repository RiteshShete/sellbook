import { Check } from 'lucide-react'
import { useState } from 'react'
import { ActionButton, Button, ConfirmDialog } from '../../../components/ui'
import { actionKindForMove } from '../../../lib/actionStyles'
import { useOrderBusy, useSetStatus } from '../hooks/useOrderActions'
import { needsItems, paymentLabel, paymentState, statusMoves, type StatusMove } from '../pipeline'
import type { OrderWithItems } from '../schemas'
import { PaymentSheet } from './PaymentSheet'

/**
 * Status moves (B1, every move undoable via toast) and the payment sheet (B2). The forward move
 * and payment are the main actions; going back and cancelling sit apart under "More actions".
 * Styles come from lib/actionStyles.ts, the same as on the cards.
 */
export function OrderActions({ order }: { order: OrderWithItems }) {
  const setStatus = useSetStatus()
  // A payment change in flight bumps the version too, so wait for it as well.
  const busy = useOrderBusy(order.id)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const moves = statusMoves(order)
  const blocked = (m: StatusMove) => needsItems(m.to) && order.items.length === 0 // B9

  const move = (m: StatusMove) => setStatus.mutate({ order, from: order.status, to: m.to })

  const primary = moves.find((m) => m.kind === 'forward' || m.kind === 'restore')
  const others = moves.filter((m) => m !== primary && m.kind !== 'cancel')
  const cancel = moves.find((m) => m.kind === 'cancel')
  const pay = paymentState(order)

  return (
    <section className="flex flex-col gap-2">
      {primary && (
        <ActionButton
          kind={actionKindForMove(primary)}
          block
          disabled={busy || blocked(primary)}
          onClick={() => move(primary)}
        >
          {primary.label}
        </ActionButton>
      )}
      {primary && blocked(primary) && (
        <p className="text-sm text-muted">
          Add at least one item before marking it{' '}
          {primary.to === 'delivered' ? 'delivered' : 'ready'}.
        </p>
      )}

      {pay.payment_status === 'pending' ? (
        <ActionButton kind="paid" block disabled={busy} onClick={() => setPayOpen(true)}>
          Mark paid
        </ActionButton>
      ) : (
        <Button variant="secondary" block disabled={busy} onClick={() => setPayOpen(true)}>
          <Check className="h-5 w-5" aria-hidden="true" />
          {paymentLabel(pay)} · change
        </Button>
      )}

      {(others.length > 0 || cancel) && (
        <details className="group mt-2 rounded-2xl border border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 font-medium text-body">
            More actions
          </summary>
          <div className="flex flex-col gap-3 border-t border-border p-3">
            {others.map((m) => (
              <ActionButton
                key={m.to}
                kind={actionKindForMove(m)}
                block
                disabled={busy || blocked(m)}
                onClick={() => move(m)}
              >
                {m.label}
              </ActionButton>
            ))}
            {cancel && (
              <ActionButton
                kind="cancel"
                block
                className={others.length > 0 ? 'mt-3' : ''}
                disabled={busy}
                onClick={() => setConfirmCancel(true)}
              >
                {cancel.label}
              </ActionButton>
            )}
          </div>
        </details>
      )}

      <PaymentSheet order={order} open={payOpen} onClose={() => setPayOpen(false)} />
      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel order #${order.order_no}?`}
        message="It stops counting in sales. You can restore it later, or tap Undo right after."
        confirmLabel="Cancel order"
        destructive
        busy={busy}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false)
          if (cancel) move(cancel)
        }}
      />
    </section>
  )
}
