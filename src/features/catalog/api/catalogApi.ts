import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { throwIfError } from '../../../lib/dbError'
import {
  ProductSchema,
  UpsertResultSchema,
  type Product,
  type UpsertProductPayload,
} from '../schemas'

const PRODUCT_SELECT =
  'id, name, sort_order, is_active, variants (id, product_id, name, price, cost_price, sort_order, is_active, deleted_at)'

/** All live products (active and inactive) with their live variants. */
export async function fetchProducts(client: SupabaseClient): Promise<Product[]> {
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .is('deleted_at', null)
    .order('sort_order')
    .order('name')
  throwIfError(error)
  return z.array(ProductSchema).parse(data)
}

/** One live product, or null if it doesn't exist / is in Trash. */
export async function fetchProduct(client: SupabaseClient, id: string): Promise<Product | null> {
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  throwIfError(error)
  return data === null ? null : ProductSchema.parse(data)
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
