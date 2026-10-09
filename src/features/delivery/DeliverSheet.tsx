import { BottomSheet } from '../../components/ui'
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
            <button
              type="button"
              onClick={() => {
                onClose()
                deliver.mutate({ order, paid: c.paid })
              }}
              className={`flex min-h-12 w-full items-center rounded-xl px-4 text-left font-medium ${c.paid ? 'bg-primary text-primary-fg active:bg-primary-active' : 'border border-border bg-surface active:bg-surface-2'}`}
            >
              {c.label}
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  )
}
