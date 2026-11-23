import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invalidateOrders } from '../../../lib/invalidate'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../auth/useAuth'
import { useCanWrite } from '../../plan/hooks/usePlan'
import { confirmOrder, declineOrder, fetchNeedsAction, fetchOrdersWithUtr, rejectPayment, verifyPayment } from '../api/customerOrdersApi'
import type { Order } from '../schemas'

type Ref = Pick<Order, 'id' | 'version_no'>

/** Customer orders waiting for the shop. Looked at again every 30 s as well as when realtime says something changed. */
export function useNeedsAction() {
  const { client, status } = useAuth()
  return useQuery({
    queryKey: queryKeys.orders.needs,
    queryFn: () => fetchNeedsAction(client),
    enabled: status === 'signedIn',
    refetchInterval: 30_000,
  })
}

export function useOrdersWithUtr(order: Pick<Order, 'id' | 'payment_reference'>) {
  const { client } = useAuth()
  const ref = order.payment_reference ?? ''
  return useQuery({
    queryKey: queryKeys.orders.utr(ref),
    queryFn: () => fetchOrdersWithUtr(client, order.id, ref),
    enabled: ref !== '',
  })
}

/** Every one of these changes the order (version, status, payment), so all order screens refresh afterwards. */
function useAction<TArg, TResult>(fn: (arg: TArg) => Promise<TResult>) {
  const queryClient = useQueryClient()
  const canWrite = useCanWrite()
  const mutation = useMutation({
    mutationFn: fn,
    // Not awaited: refreshing the lists removes this order's card, and a card that has unmounted never gets its own
    // onSuccess (the "tell the customer" step). The lists refresh in the background.
    onSettled: () => {
      void invalidateOrders(queryClient)
    },
  })
  // A read-only (ended) plan keeps these buttons off, as for every other order action.
  return { ...mutation, blocked: !canWrite }
}

export function useConfirmOrder() {
  const { client } = useAuth()
  return useAction((v: { order: Ref; note: string }) => confirmOrder(client, v.order.id, v.note, v.order.version_no))
}

export function useDeclineOrder() {
  const { client } = useAuth()
  return useAction((v: { order: Ref; reason: string }) => declineOrder(client, v.order.id, v.reason, v.order.version_no))
}

export function useVerifyPayment() {
  const { client } = useAuth()
  return useAction((order: Ref) => verifyPayment(client, order.id, order.version_no))
}

export function useRejectPayment() {
  const { client } = useAuth()
  return useAction((v: { order: Ref; reason: string }) => rejectPayment(client, v.order.id, v.reason, v.order.version_no))
}
