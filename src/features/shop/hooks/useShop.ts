import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { toast } from '../../../components/ui'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../auth/useAuth'
import type { BulkOfferRequest, UpdateShopRequest } from '../../storefront/contract'
import {
  bulkOffer,
  endOffers,
  fetchOfferVariants,
  fetchOnlineDetails,
  fetchShop,
  saveOnlineDetails,
  setPublished,
  updateShop,
} from '../api/shopApi'
import type { OnlineDetails } from '../schemas'

export function useShop() {
  const { client } = useAuth()
  return useQuery({ queryKey: queryKeys.shop, queryFn: () => fetchShop(client) })
}

export function useOfferVariants() {
  const { client } = useAuth()
  return useQuery({ queryKey: queryKeys.offers, queryFn: () => fetchOfferVariants(client) })
}

export function useOnlineDetails(productId: string) {
  const { client } = useAuth()
  return useQuery({
    queryKey: queryKeys.products.online(productId),
    queryFn: () => fetchOnlineDetails(client, productId),
  })
}

/**
 * Every shop-side mutation refreshes the shop row and the offers list (failures toast centrally).
 * `saved` is the success message. It is shown here, not in a per-call `mutate(..., { onSuccess })`: forms are keyed on
 * the data's refresh time and are rebuilt by the refresh, and a per-call callback dies with the form that made it.
 */
function useShopMutation<TArg, TResult>(fn: (arg: TArg) => Promise<TResult>, saved?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.shop }),
        queryClient.invalidateQueries({ queryKey: queryKeys.offers }),
      ])
      if (saved) toast.success(saved)
    },
  })
}

export function useUpdateShop(saved?: string) {
  const { client } = useAuth()
  return useShopMutation((patch: z.input<typeof UpdateShopRequest>) => updateShop(client, patch), saved)
}

export function useSetPublished() {
  const { client } = useAuth()
  return useShopMutation((publish: boolean) => setPublished(client, publish))
}

export function useBulkOffer() {
  const { client } = useAuth()
  return useShopMutation((input: z.input<typeof BulkOfferRequest>) => bulkOffer(client, input))
}

export function useEndOffers() {
  const { client } = useAuth()
  return useShopMutation((ids: string[] | null) => endOffers(client, ids))
}

/** `saved` is shown here for the same reason as in useShopMutation (the form is rebuilt by the refresh). */
export function useSaveOnlineDetails(productId: string, saved?: string) {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<OnlineDetails>) => saveOnlineDetails(client, productId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.products.online(productId) })
      if (saved) toast.success(saved)
    },
  })
}
