import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { throwIfError } from '../../../lib/dbError'
import type { ApplyPayload } from '../planImport'

const CountsSchema = z.object({
  categories: z.number().int(),
  products: z.number().int(),
  variants: z.number().int(),
  updated: z.number().int(),
})

const ApplyResultSchema = CountsSchema.extend({ batch_id: z.guid() })
export type ApplyResult = z.infer<typeof ApplyResultSchema>

const UndoResultSchema = z.object({
  products: z.number().int(),
  variants: z.number().int(),
  restored: z.number().int(),
})
export type UndoResult = z.infer<typeof UndoResultSchema>

const BatchSchema = z.object({
  id: z.guid(),
  created_at: z.string(),
  file_name: z.string(),
  mode: z.enum(['add', 'update']),
  counts: CountsSchema,
  undone_at: z.string().nullable(),
})
export type ImportBatch = z.infer<typeof BatchSchema>

/** One transaction on the server: all of the import, or none of it. */
export async function applyImport(
  client: SupabaseClient,
  payload: ApplyPayload,
): Promise<ApplyResult> {
  const { data, error } = await client.rpc('apply_product_import', { p: payload })
  throwIfError(error)
  return ApplyResultSchema.parse(data)
}

export async function undoImport(client: SupabaseClient, id: string): Promise<UndoResult> {
  const { data, error } = await client.rpc('undo_product_import', { p_id: id })
  throwIfError(error)
  return UndoResultSchema.parse(data)
}

/** The 10 most recent imports, newest first. */
export async function fetchImportBatches(client: SupabaseClient): Promise<ImportBatch[]> {
  const { data, error } = await client
    .from('import_batches')
    .select('id, created_at, file_name, mode, counts, undone_at')
    .order('created_at', { ascending: false })
    .limit(10)
  throwIfError(error)
  return z.array(BatchSchema).parse(data)
}
