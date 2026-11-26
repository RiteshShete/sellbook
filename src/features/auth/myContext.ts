import { useQuery } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { throwIfError } from '../../lib/dbError'
import { queryKeys } from '../../lib/queryKeys'
import { MyContextSchema } from '../storefront/contract'
import { useAuth } from './useAuth'

export type MyContext = z.infer<typeof MyContextSchema>

export async function fetchMyContext(client: SupabaseClient): Promise<MyContext> {
  const { data, error } = await client.rpc('my_context')
  throwIfError(error)
  return MyContextSchema.parse(data)
}

/** Owner of a shop, customer, both, or neither (an old self-sign-up owner who has no online shop yet). */
export function useMyContext() {
  const { client, session } = useAuth()
  return useQuery({
    queryKey: [...queryKeys.myContext, session?.user.id ?? null],
    queryFn: () => fetchMyContext(client),
    enabled: Boolean(session),
    staleTime: 60_000,
  })
}

/**
 * A customer who is not also a shop owner. The database already refuses such an account every owner table
 * (restrictive policy); the screens use the same rule to keep them out of the owner app.
 */
export const isCustomerOnly = (ctx: MyContext): boolean => ctx.has_customer_profile && !ctx.is_owner
