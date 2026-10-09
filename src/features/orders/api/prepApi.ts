import type { SupabaseClient } from '@supabase/supabase-js'
import { throwIfError } from '../../../lib/dbError'
import { PrepListSchema, type PrepList } from '../prep'

/** What to make for all "new" orders, summed per product and variant. */
export async function fetchPrepList(client: SupabaseClient): Promise<PrepList> {
  const { data, error } = await client.rpc('prep_list')
  throwIfError(error)
  return PrepListSchema.parse(data)
}
