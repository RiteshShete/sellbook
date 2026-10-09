import {
  useIsMutating,
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { toast } from '../../../components/ui'
import { invalidateOrders } from '../../../lib/invalidate'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../auth/useAuth'
import { setOrderStatus, setPayment } from '../api/ordersApi'
import { moveMessage, paymentLabel, type PaymentState } from '../pipeline'
import type { Order, OrderStatus, OrderWithItems } from '../schemas'

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

/** Status and payment mutations share this key so one order's buttons can wait for both. */
const ORDER_ACTION = ['orderAction'] as const

/** Highest version_no this device has seen per order (from any status or payment change). */
const seenVersion = new Map<string, number>()

/**
 * The order with the newest version we know of. An Undo toast holds the order as it was right
 * after its move; if a later change (payment, another move) bumped the version, using the old one
 * would fail as "changed on another device".
 */
function latest(qc: QueryClient, o: OrderRef): OrderRef {
  const cached = qc.getQueryData<OrderWithItems | null>(queryKeys.orders.detail(o.id))
  const version_no = Math.max(o.version_no, seenVersion.get(o.id) ?? 0, cached?.version_no ?? 0)
  return { ...o, version_no }
}

function remember(o: Order) {
  seenVersion.set(o.id, Math.max(o.version_no, seenVersion.get(o.id) ?? 0))
}

function isForOrder(variables: unknown, orderId: string): boolean {
  if (typeof variables !== 'object' || variables === null || !('order' in variables)) return false
  const { order } = variables
  return typeof order === 'object' && order !== null && 'id' in order && order.id === orderId
}

/** True while a status or payment change for this order is running (and its refetch). */
export function useOrderBusy(orderId: string): boolean {
  return (
    useIsMutating({
      mutationKey: ORDER_ACTION,
      predicate: (m) => isForOrder(m.state.variables, orderId),
    }) > 0
  )
}

/**
 * Status moves with an Undo toast. Toasts live in the hook-level callbacks so they still fire
 * when the card that started the move has already left the list (e.g. Delivery stack).
 */
export function useSetStatus() {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  const m: UseMutationResult<Order, Error, StatusVars> = useMutation({
    mutationKey: ORDER_ACTION,
    mutationFn: (v: StatusVars) => setOrderStatus(client, v.order.id, v.to, v.order.version_no),
    onSuccess: (updated, v) => {
      remember(updated)
      if (v.isUndo) {
        toast.success('Undone')
        return
      }
      toast.success(moveMessage(updated.order_no, v.from, v.to), {
        action: {
          label: 'Undo',
          onClick: () =>
            m.mutate({ order: latest(queryClient, updated), from: v.to, to: v.from, isUndo: true }),
        },
      })
    },
    onSettled: () => invalidateOrders(queryClient),
  })
  return m
}

/** Payment changes (B2) with the same Undo pattern. */
export function useSetPayment() {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  const m: UseMutationResult<Order, Error, PaymentVars> = useMutation({
    mutationKey: ORDER_ACTION,
    mutationFn: (v: PaymentVars) => setPayment(client, v.order.id, v.to, v.order.version_no),
    onSuccess: (updated, v) => {
      remember(updated)
      if (v.isUndo) {
        toast.success('Undone')
        return
      }
      toast.success(`#${updated.order_no}: ${paymentLabel(v.to)}`, {
        action: {
          label: 'Undo',
          onClick: () =>
            m.mutate({ order: latest(queryClient, updated), from: v.to, to: v.from, isUndo: true }),
        },
      })
    },
    onSettled: () => invalidateOrders(queryClient),
  })
  return m
}
