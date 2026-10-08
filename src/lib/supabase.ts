import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Env } from './env'

let client: SupabaseClient | null = null

/** Browser client. Uses the public anon key only. */
export function getSupabase(env: Env): SupabaseClient {
  client ??= createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return client
}
