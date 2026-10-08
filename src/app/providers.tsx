import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Toast } from '../components/ui'
import { AuthProvider } from '../features/auth/AuthProvider'
import type { Env } from '../lib/env'
import { getSupabase } from '../lib/supabase'

export function Providers({ env, children }: { env: Env; children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
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
