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
  /** Creates the account and sends the confirmation email. Never says whether the email was already used. */
  signUp: (email: string, password: string) => Promise<void>
  /** Sends a reset link (if the account exists). */
  resetPassword: (email: string) => Promise<void>
  /** Sets a new password for the signed-in user (the reset link signs them in). */
  updatePassword: (password: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
