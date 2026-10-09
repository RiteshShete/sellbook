import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

/** After anything that changes orders: lists, details, versions, trash, activity and analytics. */
export function invalidateOrders(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.orders.all }),
    qc.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    qc.invalidateQueries({ queryKey: queryKeys.pending }),
    qc.invalidateQueries({ queryKey: queryKeys.trash.all }),
    qc.invalidateQueries({ queryKey: queryKeys.activity.all }),
  ])
}

/**
 * After anything that changes the catalog. Orders too: the prep list sorts by catalog order and
 * reads variant sizes, and order details embed the variant.
 */
export function invalidateCatalog(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.products.all }),
    qc.invalidateQueries({ queryKey: queryKeys.orders.all }),
    qc.invalidateQueries({ queryKey: queryKeys.trash.all }),
    qc.invalidateQueries({ queryKey: queryKeys.activity.all }),
  ])
}
