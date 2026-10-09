import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invalidateCatalog } from '../../../lib/invalidate'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../auth/useAuth'
import {
  fetchProduct,
  fetchProducts,
  trashProduct,
  trashVariant,
  upsertProduct,
} from '../api/catalogApi'
import type { UpsertProductPayload } from '../schemas'

export function useProducts() {
  const { client } = useAuth()
  return useQuery({ queryKey: queryKeys.products.list(), queryFn: () => fetchProducts(client) })
}

export function useProduct(id: string | undefined) {
  const { client } = useAuth()
  return useQuery({
    queryKey: queryKeys.products.detail(id ?? 'new'),
    // enabled guards the undefined case.
    queryFn: () => fetchProduct(client, id ?? ''),
    enabled: id !== undefined,
  })
}

/** Shared by every catalog mutation: refresh catalog queries (failures toast centrally). */
function useCatalogMutation<TArg, TResult>(fn: (arg: TArg) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidateCatalog(queryClient),
  })
}

export function useSaveProduct() {
  const { client } = useAuth()
  return useCatalogMutation((p: UpsertProductPayload) => upsertProduct(client, p))
}

export function useTrashProduct() {
  const { client } = useAuth()
  return useCatalogMutation((id: string) => trashProduct(client, id))
}

export function useTrashVariant() {
  const { client } = useAuth()
  return useCatalogMutation((id: string) => trashVariant(client, id))
}
