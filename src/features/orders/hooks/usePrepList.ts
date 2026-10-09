import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../auth/useAuth'
import { fetchPrepList } from '../api/prepApi'

export function usePrepList() {
  const { client } = useAuth()
  return useQuery({ queryKey: queryKeys.orders.prep, queryFn: () => fetchPrepList(client) })
}
