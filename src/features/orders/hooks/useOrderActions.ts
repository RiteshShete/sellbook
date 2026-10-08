import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { toast } from '../../../components/ui'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../auth/useAuth'
import { setOrderStatus, setPayment } from '../api/ordersApi'
import { moveMessage, paymentLabel, type PaymentState } from '../pipeline'
import type { Order, OrderStatus } from '../schemas'

type OrderRef = Pick<Order, 'id' | 'order_no' | 'version_no'>

interface StatusVars {
  order: OrderRef
  from: OrderStatus
  to: OrderStatus
  isUndo?: boolean
}

interface PaymentVars {
  order: OrderRef
  from: PaymentState
  to: PaymentState
  isUndo?: boolean
}

/**
 * Status moves with an Undo toast. Toasts live in the hook-level callbacks so they still fire
 * when the card that started the move has already left the list (e.g. Delivery stack).
 */
export function useSetStatus() {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  const m: UseMutationResult<Order, Error, StatusVars> = useMutation({
    mutationFn: (v: StatusVars) => setOrderStatus(client, v.order.id, v.to, v.order.version_no),
    onSuccess: (updated, v) => {
      if (v.isUndo) {
        toast.success('Undone')
        return
      }
      toast.success(moveMessage(updated.order_no, v.from, v.to), {
        action: {
          label: 'Undo',
          onClick: () => m.mutate({ order: updated, from: v.to, to: v.from, isUndo: true }),
        },
      })
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
  })
  return m
}

/** Payment changes (B2) with the same Undo pattern. */
export function useSetPayment() {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  const m: UseMutationResult<Order, Error, PaymentVars> = useMutation({
    mutationFn: (v: PaymentVars) => setPayment(client, v.order.id, v.to, v.order.version_no),
    onSuccess: (updated, v) => {
      if (v.isUndo) {
        toast.success('Undone')
        return
      }
      toast.success(`#${updated.order_no}: ${paymentLabel(v.to)}`, {
        action: {
          label: 'Undo',
          onClick: () => m.mutate({ order: updated, from: v.to, to: v.from, isUndo: true }),
        },
      })
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
  })
  return m
}
