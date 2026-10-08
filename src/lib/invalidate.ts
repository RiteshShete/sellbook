import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

/** After anything that changes orders: lists, details, versions, trash and the activity log. */
export function invalidateOrders(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.orders.all }),
    qc.invalidateQueries({ queryKey: queryKeys.trash.all }),
    qc.invalidateQueries({ queryKey: ['activity'] }),
  ])
}

/** After anything that changes the catalog. */
export function invalidateCatalog(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.products.all }),
    qc.invalidateQueries({ queryKey: queryKeys.trash.all }),
    qc.invalidateQueries({ queryKey: ['activity'] }),
  ])
}
