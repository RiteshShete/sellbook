import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Toast, toast } from '../components/ui'
import { AuthProvider } from '../features/auth/AuthProvider'
import { errorMessage } from '../lib/dbError'
import type { Env } from '../lib/env'
import { getSupabase } from '../lib/supabase'

export function Providers({ env, children }: { env: Env; children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Every failed mutation surfaces as one toast; hooks only add success handling.
        mutationCache: new MutationCache({ onError: (e) => toast.error(errorMessage(e)) }),
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
      }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider client={getSupabase(env)}>{children}</AuthProvider>
      <Toast />
    </QueryClientProvider>
  )
}
