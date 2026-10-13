import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { throwIfError } from '../../../lib/dbError'

export const ACTIVITY_ENTITIES = ['all', 'order', 'product', 'variant', 'settings'] as const
export type ActivityEntity = (typeof ACTIVITY_ENTITIES)[number]

export const AuditRowSchema = z.object({
  id: z.number().int(),
  created_at: z.string(),
  entity: z.enum(['order', 'product', 'variant', 'settings', 'bill']),
  entity_id: z.guid().nullable(),
  action: z.string(),
  summary: z.string(),
})
export type AuditRow = z.infer<typeof AuditRowSchema>

export const ACTIVITY_PAGE = 30

/** Newest first; `before` is the smallest id already shown (keyset paging). */
export async function fetchActivity(
  client: SupabaseClient,
  entity: ActivityEntity,
  before: number | null,
): Promise<AuditRow[]> {
  let q = client
    .from('audit_log')
    .select('id, created_at, entity, entity_id, action, summary')
    .order('id', { ascending: false })
    .limit(ACTIVITY_PAGE)
  if (entity !== 'all') q = q.eq('entity', entity)
  if (before !== null) q = q.lt('id', before)
  const { data, error } = await q
  throwIfError(error)
  return z.array(AuditRowSchema).parse(data)
}
