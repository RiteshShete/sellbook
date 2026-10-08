import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { createContext } from 'react'

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut'

export interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  /** Anon-key browser client, shared by all features. */
  client: SupabaseClient
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
