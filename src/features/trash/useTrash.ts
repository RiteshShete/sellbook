import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '../../components/ui'
import { invalidateCatalog, invalidateOrders } from '../../lib/invalidate'
import { queryKeys } from '../../lib/queryKeys'
import { useAuth } from '../auth/useAuth'
import { restoreProduct, restoreVariant } from '../catalog/api/catalogApi'
import { restoreOrder } from '../orders/api/ordersApi'
import { fetchTrash, type TrashRow, type TrashTab } from './api/trashApi'

export function useTrashList(tab: TrashTab) {
  const { client } = useAuth()
  return useQuery({ queryKey: queryKeys.trash.tab(tab), queryFn: () => fetchTrash(client, tab) })
}

/** The tab travels with each call, so switching tabs mid-restore refreshes the right lists. */
export function useRestore() {
  const { client } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ tab, row }: { tab: TrashTab; row: TrashRow }) => {
      if (tab === 'orders') await restoreOrder(client, row.id)
      else if (tab === 'products') await restoreProduct(client, row.id)
      else await restoreVariant(client, row.id)
    },
    onSuccess: (_r, { row }) => toast.success(`${row.title} restored`),
    onSettled: (_r, _e, { tab }) =>
      tab === 'orders' ? invalidateOrders(qc) : invalidateCatalog(qc),
  })
}
