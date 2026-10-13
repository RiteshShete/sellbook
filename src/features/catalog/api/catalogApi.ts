import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { throwIfError } from '../../../lib/dbError'
import { compareNames } from '../../../lib/format'
import {
  CategorySchema,
  ProductSchema,
  UpsertResultSchema,
  type Category,
  type Product,
  type UpsertProductPayload,
} from '../schemas'

const VARIANT_COLUMNS =
  'variants (id, product_id, name, price, cost_price, size_amount, size_unit, sort_order, is_active, deleted_at)'
const PRODUCT_SELECT = `id, name, sort_order, is_active, category_id, ${VARIANT_COLUMNS}`
/** Without category_id: for a database where the categories migration is not applied yet. */
const PRODUCT_SELECT_LEGACY = `id, name, sort_order, is_active, ${VARIANT_COLUMNS}`

/** Postgres / PostgREST codes for "this column / table does not exist (yet)". */
const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])
const isMissingSchema = (error: { code?: string } | null) =>
  error !== null && error.code !== undefined && MISSING_SCHEMA.has(error.code)

/** All live products (active and inactive) with their live variants. */
export async function fetchProducts(client: SupabaseClient): Promise<Product[]> {
  const run = (select: string) =>
    client.from('products').select(select).is('deleted_at', null).order('sort_order').order('name')
  let { data, error } = await run(PRODUCT_SELECT)
  // Safe on an older database: no category column means every product is Uncategorised.
  if (isMissingSchema(error)) ({ data, error } = await run(PRODUCT_SELECT_LEGACY))
  throwIfError(error)
  // The server orders by sort_order then name in its own collation; ties are re-sorted Marathi-aware.
  return z
    .array(ProductSchema)
    .parse(data)
    .sort((a, b) => a.sort_order - b.sort_order || compareNames(a.name, b.name))
}

/** One live product, or null if it doesn't exist / is in Trash. */
export async function fetchProduct(client: SupabaseClient, id: string): Promise<Product | null> {
  const run = (select: string) =>
    client.from('products').select(select).eq('id', id).is('deleted_at', null).maybeSingle()
  let { data, error } = await run(PRODUCT_SELECT)
  if (isMissingSchema(error)) ({ data, error } = await run(PRODUCT_SELECT_LEGACY))
  throwIfError(error)
  return data === null ? null : ProductSchema.parse(data)
}

/** Live categories in the owner's order. `available: false` = the migration is not applied yet. */
export async function fetchCategories(
  client: SupabaseClient,
): Promise<{ available: boolean; categories: Category[] }> {
  const { data, error } = await client
    .from('categories')
    .select('id, name, sort_order')
    .is('deleted_at', null)
    .order('sort_order')
    .order('name')
  if (isMissingSchema(error)) return { available: false, categories: [] }
  throwIfError(error)
  return { available: true, categories: z.array(CategorySchema).parse(data) }
}

export async function upsertCategory(
  client: SupabaseClient,
  p: { id?: string; name: string },
): Promise<string> {
  const { data, error } = await client.rpc('upsert_category', { p })
  throwIfError(error)
  return UpsertResultSchema.parse(data).id
}

export async function reorderCategories(client: SupabaseClient, ids: string[]): Promise<void> {
  const { error } = await client.rpc('reorder_categories', { p_ids: ids })
  throwIfError(error)
}

export async function trashCategory(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc('trash_category', { p_id: id })
  throwIfError(error)
}

export async function restoreCategory(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc('restore_category', { p_id: id })
  throwIfError(error)
}

export async function upsertProduct(
  client: SupabaseClient,
  payload: UpsertProductPayload,
): Promise<string> {
  const { data, error } = await client.rpc('upsert_product', { p: payload })
  throwIfError(error)
  return UpsertResultSchema.parse(data).id
}

export async function trashProduct(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc('trash_product', { p_id: id })
  throwIfError(error)
}

export async function trashVariant(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc('trash_variant', { p_id: id })
  throwIfError(error)
}

export async function restoreProduct(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc('restore_product', { p_id: id })
  throwIfError(error)
}

export async function restoreVariant(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc('restore_variant', { p_id: id })
  throwIfError(error)
}
