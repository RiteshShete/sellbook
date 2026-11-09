import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../auth/useAuth'
import {
  ACTIVITY_PAGE,
  fetchActivity,
  fetchEntityItem,
  fetchOrderItems,
  fetchProductItems,
  fetchVariantItems,
  type ActivityTab,
  type EntityKind,
} from '../api/activityApi'

/** The change feed: everything (`entityId` null) or the log of one order / product / variant. */
export function useActivityFeed(tab: ActivityTab, entityId: string | null) {
  const { client } = useAuth()
  return useInfiniteQuery({
    queryKey: queryKeys.activity.feed(tab, entityId),
    queryFn: ({ pageParam }) => fetchActivity(client, tab, entityId, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => (last.length === ACTIVITY_PAGE ? (last.at(-1)?.id ?? null) : null),
  })
}

/** Orders (paged, searchable), products or variants: the things you open to see a log. */
export function useEntityList(kind: EntityKind, search: string) {
  const { client } = useAuth()
  return useInfiniteQuery({
    queryKey: queryKeys.activity.entities(kind, kind === 'order' ? search : ''),
    queryFn: ({ pageParam }) =>
      kind === 'order'
        ? fetchOrderItems(client, search, pageParam)
        : kind === 'product'
          ? fetchProductItems(client)
          : fetchVariantItems(client),
    initialPageParam: null as number | null,
    getNextPageParam: (last) =>
      last.length === ACTIVITY_PAGE ? (last.at(-1)?.orderNo ?? null) : null,
  })
}

export function useEntityItem(kind: EntityKind, id: string) {
  const { client } = useAuth()
  return useQuery({
    queryKey: queryKeys.activity.entity(kind, id),
    queryFn: () => fetchEntityItem(client, kind, id),
  })
}
