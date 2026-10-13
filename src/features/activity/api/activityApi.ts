import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { throwIfError } from '../../../lib/dbError'
import { variantLabel } from '../../../lib/variants'
import { SizeUnitSchema, dbAmount } from '../../../lib/measure'

export const ACTIVITY_TABS = ['all', 'order', 'product', 'variant'] as const
export type ActivityTab = (typeof ACTIVITY_TABS)[number]
export type EntityKind = Exclude<ActivityTab, 'all'>

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

/** Which audit entities each tab shows. Settings changes are never shown here. Bills belong to their order. */
const TAB_ENTITIES: Record<ActivityTab, string[]> = {
  all: ['order', 'bill', 'product', 'variant'],
  order: ['order', 'bill'],
  product: ['product'],
  variant: ['variant'],
}

/** Newest first; `before` is the smallest id already shown (keyset paging). `entityId` = one thing's log. */
export async function fetchActivity(
  client: SupabaseClient,
  tab: ActivityTab,
  entityId: string | null,
  before: number | null,
): Promise<AuditRow[]> {
  let q = client
    .from('audit_log')
    .select('id, created_at, entity, entity_id, action, summary')
    .in('entity', TAB_ENTITIES[tab])
    .order('id', { ascending: false })
    .limit(ACTIVITY_PAGE)
  if (entityId) q = q.eq('entity_id', entityId)
  if (before !== null) q = q.lt('id', before)
  const { data, error } = await q
  throwIfError(error)
  return z.array(AuditRowSchema).parse(data)
}

/** A thing that has a log: an order (#13), a product or a variant. */
export interface EntityItem {
  id: string
  title: string
  subtitle: string | null
  trashed: boolean
  /** Orders only: the number paging continues from. */
  orderNo?: number
}

const OrderItemSchema = z.object({
  id: z.guid(),
  order_no: z.number().int(),
  customer_name: z.string(),
  deleted_at: z.string().nullable(),
})
const ProductItemSchema = z.object({
  id: z.guid(),
  name: z.string(),
  deleted_at: z.string().nullable(),
})
const VariantItemSchema = z.object({
  id: z.guid(),
  name: z.string(),
  size_amount: dbAmount.nullable(),
  size_unit: SizeUnitSchema.nullable(),
  deleted_at: z.string().nullable(),
  products: z.object({ name: z.string() }).nullable(),
})

const orderItem = (r: z.infer<typeof OrderItemSchema>): EntityItem => ({
  id: r.id,
  title: `#${r.order_no}`,
  subtitle: r.customer_name,
  trashed: r.deleted_at !== null,
  orderNo: r.order_no,
})
const productItem = (r: z.infer<typeof ProductItemSchema>): EntityItem => ({
  id: r.id,
  title: r.name,
  subtitle: null,
  trashed: r.deleted_at !== null,
})
const variantItem = (r: z.infer<typeof VariantItemSchema>): EntityItem => ({
  id: r.id,
  title: r.products?.name ?? 'Product',
  subtitle: variantLabel(r),
  trashed: r.deleted_at !== null,
})

const ORDER_COLS = 'id, order_no, customer_name, deleted_at'
const VARIANT_COLS = 'id, name, size_amount, size_unit, deleted_at, products(name)'

/** Orders, newest number first. Search by "#13" / "13" or by part of the customer name. */
export async function fetchOrderItems(
  client: SupabaseClient,
  search: string,
  before: number | null,
): Promise<EntityItem[]> {
  let q = client
    .from('orders')
    .select(ORDER_COLS)
    .order('order_no', { ascending: false })
    .limit(ACTIVITY_PAGE)
  const term = search.trim()
  const asNumber = /^#?(\d+)$/.exec(term)
  if (asNumber) q = q.eq('order_no', Number(asNumber[1]))
  else if (term) q = q.ilike('customer_name', `%${term.replace(/[%_\\]/g, '\\$&')}%`)
  if (before !== null) q = q.lt('order_no', before)
  const { data, error } = await q
  throwIfError(error)
  return z.array(OrderItemSchema).parse(data).map(orderItem)
}

/** All products (trashed ones too: their history still matters). A handful of rows, so no paging. */
export async function fetchProductItems(client: SupabaseClient): Promise<EntityItem[]> {
  const { data, error } = await client
    .from('products')
    .select('id, name, deleted_at')
    .order('name')
    .limit(500)
  throwIfError(error)
  return z.array(ProductItemSchema).parse(data).map(productItem)
}

export async function fetchVariantItems(client: SupabaseClient): Promise<EntityItem[]> {
  const { data, error } = await client
    .from('variants')
    .select(VARIANT_COLS)
    .order('name')
    .limit(1000)
  throwIfError(error)
  return z.array(VariantItemSchema).parse(data).map(variantItem)
}

/** One thing's heading for its log page. Null when it does not exist. */
export async function fetchEntityItem(
  client: SupabaseClient,
  kind: EntityKind,
  id: string,
): Promise<EntityItem | null> {
  if (kind === 'order') {
    const { data, error } = await client
      .from('orders')
      .select(ORDER_COLS)
      .eq('id', id)
      .maybeSingle()
    throwIfError(error)
    return data ? orderItem(OrderItemSchema.parse(data)) : null
  }
  if (kind === 'product') {
    const { data, error } = await client
      .from('products')
      .select('id, name, deleted_at')
      .eq('id', id)
      .maybeSingle()
    throwIfError(error)
    return data ? productItem(ProductItemSchema.parse(data)) : null
  }
  const { data, error } = await client
    .from('variants')
    .select(VARIANT_COLS)
    .eq('id', id)
    .maybeSingle()
  throwIfError(error)
  return data ? variantItem(VariantItemSchema.parse(data)) : null
}
