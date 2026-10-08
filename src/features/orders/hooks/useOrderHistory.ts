import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { toast } from '../../../components/ui'
import { invalidateOrders } from '../../../lib/invalidate'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../auth/useAuth'
import { fetchVersions, restoreOrder, rollbackOrder, trashOrder } from '../api/ordersApi'
import type { Order } from '../schemas'

export function useOrderVersions(orderId: string) {
  const { client } = useAuth()
  return useQuery({
    queryKey: queryKeys.orders.versions(orderId),
    queryFn: () => fetchVersions(client, orderId),
  })
}

export function useRollback() {
  const { client } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { order: Pick<Order, 'id' | 'version_no'>; target: number }) =>
      rollbackOrder(client, v.order.id, v.target, v.order.version_no),
    onSuccess: (_o, v) => toast.success(`Rolled back to version ${v.target}`),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => invalidateOrders(qc),
  })
}

/** Move to Trash with an Undo toast (restore). */
export function useTrashOrder() {
  const { client } = useAuth()
  const qc = useQueryClient()
  const restore = useRestoreOrder()
  const m: UseMutationResult<Order, Error, Pick<Order, 'id' | 'order_no'>> = useMutation({
    mutationFn: (o: Pick<Order, 'id' | 'order_no'>) => trashOrder(client, o.id),
    onSuccess: (o) =>
      toast.success(`#${o.order_no} moved to Trash`, {
        action: { label: 'Undo', onClick: () => restore.mutate(o) },
      }),
    onError: (e) => toast.error(e.message),
    onSettled: () => invalidateOrders(qc),
  })
  return m
}

export function useRestoreOrder() {
  const { client } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (o: Pick<Order, 'id' | 'order_no'>) => restoreOrder(client, o.id),
    onSuccess: (o) => toast.success(`#${o.order_no} restored`),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => invalidateOrders(qc),
  })
}
