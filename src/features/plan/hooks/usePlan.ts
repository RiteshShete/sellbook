import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from '../../../components/ui'
import { todayIST } from '../../../lib/dates'
import { downloadBlob } from '../../../lib/share'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../auth/useAuth'
import {
  cancelSubscriptionRequest,
  exportMyData,
  fetchPlan,
  fetchPlanLimits,
  requestSubscription,
} from '../api/planApi'

/** The shop's plan and usage. Refreshed after every mutation (see providers.tsx). */
export function usePlan() {
  const { client } = useAuth()
  return useQuery({
    queryKey: queryKeys.plan,
    queryFn: () => fetchPlan(client),
    // While a payment waits for approval, look again every 30 s so the plan switches on by itself.
    refetchInterval: (q) => (q.state.data?.request?.status === 'pending' ? 30_000 : false),
  })
}

/**
 * May the shop add or change things? False once the plan has ended (read-only, then locked). True while loading
 * or when the plan cannot be read: the database is what enforces it, the screen only avoids offering what would fail.
 */
export function useCanWrite(): boolean {
  const plan = usePlan()
  return plan.data?.can_write ?? true
}

/** The plan is re-read after every mutation (providers.tsx), so these need no invalidation of their own. */
export function useRequestSubscription() {
  const { client } = useAuth()
  return useMutation({
    mutationFn: ({ tier, utr }: { tier: 'base' | 'pro'; utr: string }) =>
      requestSubscription(client, tier, utr),
    onSuccess: () => toast.success('Sent. We will check your payment and switch on the plan.'),
  })
}

export function useCancelRequest() {
  const { client } = useAuth()
  return useMutation({ mutationFn: () => cancelSubscriptionRequest(client) })
}

export function usePlanLimits() {
  const { client } = useAuth()
  return useQuery({
    queryKey: queryKeys.planLimits,
    queryFn: () => fetchPlanLimits(client),
    staleTime: Infinity,
  })
}

/**
 * May the shop use Pro features? null while loading. If the plan cannot be read we do not hide anything:
 * the database is what enforces plans, the UI only avoids showing things that would fail.
 */
export function usePro(): boolean | null {
  const plan = usePlan()
  if (plan.isPending) return null
  return plan.data?.pro_features ?? true
}

/** "Download my data": saves everything the shop has entered as a JSON file. */
export function useExportMyData() {
  const { client } = useAuth()
  return useMutation({
    mutationFn: async () => {
      const json = await exportMyData(client)
      downloadBlob(new Blob([json], { type: 'application/json' }), `sellbook-data-${todayIST()}.json`)
    },
    onSuccess: () => toast.success('Saved your data'),
  })
}
