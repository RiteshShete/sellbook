import { ActionButton, BottomSheet, Button } from '../../components/ui'
import { formatINR } from '../../lib/money'
import { useDeliver } from '../orders/hooks/useOrderActions'
import type { OrderListRow } from '../orders/schemas'

const CHOICES = [
  { label: 'Paid cash', paid: { payment_status: 'paid', payment_mode: 'cash' } },
  { label: 'Paid online', paid: { payment_status: 'paid', payment_mode: 'online' } },
  { label: 'Not paid yet', paid: null },
] as const

/** Delivering an unpaid order: record what happened with the money in the same tap. */
export function DeliverSheet({
  order,
  open,
  onClose,
}: {
  order: OrderListRow
  open: boolean
  onClose: () => void
}) {
  const deliver = useDeliver()
  const pick = (paid: (typeof CHOICES)[number]['paid']) => {
    onClose()
    deliver.mutate({ order, paid })
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Deliver #${order.order_no} · ${order.customer_name}`}
    >
      <p className="mb-3 text-sm text-muted">Collect {formatINR(order.total)}. Payment?</p>
      <ul className="flex flex-col gap-2">
        {CHOICES.map((c) => (
          <li key={c.label}>
            {c.paid ? (
              <ActionButton
                kind="paid"
                block
                className="min-h-12 justify-start"
                onClick={() => pick(c.paid)}
              >
                {c.label}
              </ActionButton>
            ) : (
              <Button
                variant="secondary"
                block
                className="min-h-12 justify-start"
                onClick={() => pick(null)}
              >
                {c.label}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </BottomSheet>
  )
}
