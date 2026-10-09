import { History } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, ConfirmDialog } from '../../../components/ui'
import { useTrashOrder } from '../hooks/useOrderHistory'
import type { Order } from '../schemas'

/** History link + Move to Trash (soft delete with Undo). */
export function OrderMoreActions({ order }: { order: Pick<Order, 'id' | 'order_no'> }) {
  const navigate = useNavigate()
  const trash = useTrashOrder()
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="flex items-center gap-2 border-t border-border pt-3">
      <Link
        to={`/orders/${order.id}/history`}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 font-medium text-text"
      >
        <History className="h-5 w-5" /> History
      </Link>
      <Button variant="ghost" className="ml-auto text-danger" onClick={() => setConfirm(true)}>
        Move to Trash
      </Button>
      <ConfirmDialog
        open={confirm}
        title={`Move #${order.order_no} to Trash?`}
        message="It disappears from lists and stops counting in sales. You can restore it from Trash."
        confirmLabel="Move to Trash"
        destructive
        busy={trash.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          trash.mutate(order, {
            onSuccess: () => void navigate('/orders', { replace: true }),
          })
        }
      />
    </div>
  )
}
