import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invalidateOrders } from '../../../lib/invalidate'
import { queryKeys } from '../../../lib/queryKeys'
import { useObjectUrl } from '../../../lib/useObjectUrl'
import { useAuth } from '../../auth/useAuth'
import type { Settings } from '../../settings/schemas'
import { downloadBillImage, fetchBillState } from '../api/billsApi'
import { generateBill, type GeneratedBill } from '../generateBill'

export function useBillState(orderId: string) {
  const { client } = useAuth()
  return useQuery({
    queryKey: queryKeys.orders.bills(orderId),
    queryFn: () => fetchBillState(client, orderId),
  })
}

/** A stored bill image as a Blob (ready for an instant Share tap) and an object URL to show it. */
export function useBillImage(path: string | null) {
  const { client } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.billImage(path ?? ''),
    // enabled guards the null case.
    queryFn: () => downloadBillImage(client, path ?? ''),
    enabled: path !== null,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  })
  const url = useObjectUrl(query.data)
  return { blob: query.data, url, isLoading: query.isLoading, error: query.error }
}

export function useGenerateBill(orderId: string) {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: Settings) => generateBill(client, settings, orderId),
    onSuccess: ({ bill, png }: GeneratedBill) => {
      // Seed the cache with the PNG just made, so Share works without a download.
      queryClient.setQueryData(queryKeys.billImage(bill.image_path), png)
      // The first bill also gave the order its number; settings.next_bill_no moved on.
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings })
    },
    onSettled: () => invalidateOrders(queryClient),
  })
}
