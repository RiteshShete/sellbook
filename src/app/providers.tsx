import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { Toast, toast } from '../components/ui'
import { AuthProvider } from '../features/auth/AuthProvider'
import { errorMessage } from '../lib/dbError'
import type { Env } from '../lib/env'
import { queryKeys } from '../lib/queryKeys'
import { getSupabase } from '../lib/supabase'
import { installGlobalErrorHandlers } from './globalErrors'

export function Providers({ env, children }: { env: Env; children: ReactNode }) {
  const [queryClient] = useState(() => {
    const qc: QueryClient = new QueryClient({
      mutationCache: new MutationCache({
        // Every failed mutation surfaces as one toast; hooks only add success handling.
        onError: (e) => toast.error(errorMessage(e)),
        // Any write can change plan usage (or hit a limit), so the plan is re-read after each one.
        onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.plan }),
      }),
      defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
    })
    return qc
  })
  useEffect(() => installGlobalErrorHandlers(), [])
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider client={getSupabase(env)}>{children}</AuthProvider>
      <Toast />
    </QueryClientProvider>
  )
}
