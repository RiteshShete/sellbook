import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '../../../components/ui'
import { invalidateOrders } from '../../../lib/invalidate'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../auth/useAuth'
import {
  createOrder,
  fetchOrder,
  fetchOrders,
  suggestCustomers,
  updateOrder,
  type OrderTab,
} from '../api/ordersApi'
import type { OrderPayload } from '../schemas'

export function useOrders(tab: OrderTab, search: string) {
  const { client } = useAuth()
  return useQuery({
    queryKey: queryKeys.orders.list(tab, search),
    queryFn: () => fetchOrders(client, tab, search),
    placeholderData: keepPreviousData, // no flash to skeleton while typing a search
  })
}

export function useOrder(id: string) {
  const { client } = useAuth()
  return useQuery({ queryKey: queryKeys.orders.detail(id), queryFn: () => fetchOrder(client, id) })
}

export function useCustomerSuggestions(q: string) {
  const { client } = useAuth()
  const term = q.trim()
  return useQuery({
    queryKey: queryKeys.customers(term),
    queryFn: () => suggestCustomers(client, term),
    enabled: term.length >= 2,
    staleTime: 60_000,
  })
}

export function useCreateOrder() {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (p: OrderPayload) => createOrder(client, p),
    onSuccess: () => {
      void invalidateOrders(queryClient)
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUpdateOrder(id: string) {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ p, version }: { p: OrderPayload; version: number }) =>
      updateOrder(client, id, p, version),
    // Success or a stale-version failure: either way the cached order is out of date.
    onSettled: () => invalidateOrders(queryClient),
    onError: (e: Error) => toast.error(e.message),
  })
}
