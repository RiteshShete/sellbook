import { Check } from 'lucide-react'
import { BottomSheet } from '../../../components/ui'
import { formatINR } from '../../../lib/money'
import { useSetPayment } from '../hooks/useOrderActions'
import { paymentLabel, paymentState, type PaymentState } from '../pipeline'
import type { Order } from '../schemas'

const OPTIONS: PaymentState[] = [
  { payment_status: 'paid', payment_mode: 'online' },
  { payment_status: 'paid', payment_mode: 'cash' },
  { payment_status: 'pending', payment_mode: null },
]

const same = (a: PaymentState, b: PaymentState) =>
  a.payment_status === b.payment_status && a.payment_mode === b.payment_mode

export interface PaymentSheetProps {
  order: Pick<Order, 'id' | 'order_no' | 'version_no' | 'total' | 'payment_status' | 'payment_mode'>
  open: boolean
  onClose: () => void
}

/** Mark paid (online / cash) or back to not paid. The app never verifies payments. */
export function PaymentSheet({ order, open, onClose }: PaymentSheetProps) {
  const setPayment = useSetPayment()
  const current = paymentState(order)

  function choose(to: PaymentState) {
    onClose()
    if (!same(to, current)) setPayment.mutate({ order, from: current, to })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={`Payment · #${order.order_no}`}>
      <p className="mb-3 text-sm text-muted">Total {formatINR(order.total)}</p>
      <ul className="flex flex-col gap-2">
        {OPTIONS.map((o) => {
          const selected = same(o, current)
          return (
            <li key={paymentLabel(o)}>
              <button
                type="button"
                onClick={() => choose(o)}
                disabled={setPayment.isPending}
                aria-pressed={selected}
                className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-4 text-left font-medium ${selected ? 'border-text bg-surface-strong' : 'border-border bg-surface'}`}
              >
                {o.payment_status === 'paid' ? paymentLabel(o) : 'Not paid yet'}
                {selected && <Check className="h-5 w-5 text-primary" />}
              </button>
            </li>
          )
        })}
      </ul>
    </BottomSheet>
  )
}
