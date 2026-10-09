import { useState } from 'react'
import { Button, ConfirmDialog } from '../../../components/ui'
import { useOrderBusy, useSetStatus } from '../hooks/useOrderActions'
import { needsItems, paymentLabel, paymentState, statusMoves, type StatusMove } from '../pipeline'
import type { OrderWithItems } from '../schemas'
import { PaymentSheet } from './PaymentSheet'

/** Status moves (B1, every move undoable via toast) and the payment sheet (B2). */
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
  const secondary = moves.filter((m) => m !== primary && m.kind !== 'cancel')
  const cancel = moves.find((m) => m.kind === 'cancel')

  return (
    <section className="flex flex-col gap-2">
      {primary && (
        <Button block disabled={busy || blocked(primary)} onClick={() => move(primary)}>
          {primary.label}
        </Button>
      )}
      {primary && blocked(primary) && (
        <p className="text-sm text-muted">Add at least one item before marking it ready.</p>
      )}

      <Button variant="secondary" block disabled={busy} onClick={() => setPayOpen(true)}>
        Payment: {paymentLabel(paymentState(order))}
      </Button>

      <div className="flex flex-wrap gap-2">
        {secondary.map((m) => (
          <Button key={m.to} variant="ghost" disabled={busy || blocked(m)} onClick={() => move(m)}>
            {m.label}
          </Button>
        ))}
        {cancel && (
          <Button
            variant="ghost"
            className="ml-auto text-danger"
            disabled={busy}
            onClick={() => setConfirmCancel(true)}
          >
            {cancel.label}
          </Button>
        )}
      </div>

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
