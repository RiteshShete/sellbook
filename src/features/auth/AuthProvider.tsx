import { useQueryClient } from '@tanstack/react-query'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from './authContext'
import { readableAuthError } from './schemas'

interface AuthState {
  loaded: boolean
  session: Session | null
}

export function AuthProvider({
  client,
  children,
}: {
  client: SupabaseClient
  children: ReactNode
}) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ loaded: false, session: null })

  useEffect(() => {
    // Fires INITIAL_SESSION first (restored from storage), then every sign-in/out/refresh.
    const { data } = client.auth.onAuthStateChange((event, session) => {
      // Never leave one session's cached data around for the next.
      if (event === 'SIGNED_OUT') queryClient.clear()
      setState({ loaded: true, session })
    })
    return () => data.subscription.unsubscribe()
  }, [client, queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      status: !state.loaded ? 'loading' : state.session ? 'signedIn' : 'signedOut',
      session: state.session,
      client,
      signIn: async (email, password) => {
        const { error } = await client.auth.signInWithPassword({ email, password })
        if (error) throw new Error(readableAuthError(error.message))
      },
      signOut: async () => {
        const { error } = await client.auth.signOut()
        if (error) throw new Error(readableAuthError(error.message))
      },
    }),
    [client, state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
