import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '../../components/ui'
import { queryKeys } from '../../lib/queryKeys'
import { useAuth } from '../auth/useAuth'
import {
  decideRequest,
  fetchAdminRequests,
  fetchAdminStats,
  fetchIsAdmin,
  setConfig,
  type ConfigKey,
  type RequestStatus,
} from './adminApi'

/** Is the signed-in user the platform admin? (Hides or shows the Admin page; the server enforces.) */
export function useIsAdmin() {
  const { client } = useAuth()
  return useQuery({
    queryKey: queryKeys.admin.isAdmin,
    queryFn: () => fetchIsAdmin(client),
    staleTime: Infinity,
  })
}

export function useAdminRequests(status: RequestStatus) {
  const { client } = useAuth()
  return useQuery({
    queryKey: queryKeys.admin.requests(status),
    queryFn: () => fetchAdminRequests(client, status),
  })
}

export function useDecideRequest() {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; approve: boolean; reason: string }) =>
      decideRequest(client, v.id, v.approve, v.reason),
    onSuccess: (_d, v) => toast.success(v.approve ? 'Approved. The plan is on.' : 'Rejected.'),
    // Also after a failure: "already decided" means the list on screen is stale.
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.all }),
  })
}

/** The plan query (where pay_to comes from) is re-read after every mutation, see providers.tsx. */
export function useSetConfig() {
  const { client } = useAuth()
  return useMutation({
    mutationFn: (v: { key: ConfigKey; value: string }) => setConfig(client, v.key, v.value),
    onSuccess: () => toast.success('Saved'),
  })
}

export function useAdminStats() {
  const { client } = useAuth()
  return useQuery({ queryKey: queryKeys.admin.stats, queryFn: () => fetchAdminStats(client) })
}
