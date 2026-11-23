import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../auth/useAuth'
import { cancelMyOrder, fetchAddresses, fetchMyOrders, fetchOrder, fetchStoreCatalog, fetchStoreShop } from '../api/storefrontApi'
import { isOrderFinal } from '../track/timeline'

const FIVE_MINUTES = 5 * 60_000

/** The public shop. Visitors are not signed in, so everything here works with the anon key only. */
export function useStoreShop(slug: string) {
  const { client } = useAuth()
  return useQuery({ queryKey: queryKeys.store.shop(slug), queryFn: () => fetchStoreShop(client, slug), staleTime: FIVE_MINUTES })
}

export function useStoreCatalog(slug: string) {
  const { client } = useAuth()
  return useQuery({ queryKey: queryKeys.store.catalog(slug), queryFn: () => fetchStoreCatalog(client, slug), staleTime: FIVE_MINUTES })
}

export function useMyOrders(slug: string) {
  const { client, status } = useAuth()
  return useQuery({ queryKey: queryKeys.store.orders(slug), queryFn: () => fetchMyOrders(client, slug), enabled: status === 'signedIn' })
}

/** An order, checked again every 20 seconds (and when the tab is opened) until nothing more can change. */
export function useStoreOrder(id: string) {
  const { client, status } = useAuth()
  return useQuery({
    queryKey: queryKeys.store.order(id),
    queryFn: () => fetchOrder(client, id),
    enabled: status === 'signedIn',
    refetchInterval: (q) => (q.state.data && isOrderFinal(q.state.data) ? false : 20_000),
  })
}

export function useAddresses() {
  const { client, status } = useAuth()
  return useQuery({ queryKey: queryKeys.store.addresses, queryFn: () => fetchAddresses(client), enabled: status === 'signedIn' })
}

export function useCancelOrder(slug: string) {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelMyOrder(client, id),
    onSuccess: (_r, id) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.store.order(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.store.orders(slug) }),
      ]),
  })
}
