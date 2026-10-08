import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { throwIfError } from '../../../lib/dbError'
import {
  CustomerSuggestionSchema,
  OrderListRowSchema,
  OrderSchema,
  OrderWithItemsSchema,
  type CustomerSuggestion,
  type Order,
  type OrderListRow,
  type OrderPayload,
  type OrderStatus,
  type OrderWithItems,
} from '../schemas'

export type OrderTab = OrderStatus | 'all'

/** Lists are capped; search narrows further. Pagination arrives if a shop ever needs it. */
export const LIST_LIMIT = 200

/** Builds a PostgREST or() filter for name / phone digits / order or bill number. */
export function searchFilter(raw: string): string | null {
  // Characters that would break the or() syntax or act as wildcards.
  const q = raw.replace(/[%*,()"\\:]/g, ' ').trim()
  if (!q) return null
  const parts = [`customer_name.ilike.*${q}*`]
  const digits = q.replace(/\D/g, '')
  if (digits.length >= 3) parts.push(`customer_phone.like.*${digits}*`)
  // "12", "#12" or "INV-12": also match order/bill number 12.
  const num = /^(?:#|[a-z-]*-)?(\d{1,9})$/i.exec(q)?.[1]
  if (num) parts.push(`order_no.eq.${Number(num)}`, `bill_no.eq.${Number(num)}`)
  return parts.join(',')
}

export async function fetchOrders(
  client: SupabaseClient,
  tab: OrderTab,
  search: string,
): Promise<OrderListRow[]> {
  let query = client
    .from('orders')
    .select('*, order_items (quantity)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT)
  if (tab !== 'all') query = query.eq('status', tab)
  const filter = searchFilter(search)
  if (filter) query = query.or(filter)
  const { data, error } = await query
  throwIfError(error)
  return z.array(OrderListRowSchema).parse(data)
}

export async function fetchOrder(
  client: SupabaseClient,
  id: string,
): Promise<OrderWithItems | null> {
  const { data, error } = await client
    .from('orders')
    .select('*, order_items (*)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  throwIfError(error)
  return data === null ? null : OrderWithItemsSchema.parse(data)
}

export async function createOrder(client: SupabaseClient, p: OrderPayload): Promise<Order> {
  const { data, error } = await client.rpc('create_order', { p })
  throwIfError(error)
  return OrderSchema.parse(data)
}

export async function updateOrder(
  client: SupabaseClient,
  id: string,
  p: OrderPayload,
  version: number,
): Promise<Order> {
  const { data, error } = await client.rpc('update_order', { p_id: id, p, p_version: version })
  throwIfError(error)
  return OrderSchema.parse(data)
}

export async function suggestCustomers(
  client: SupabaseClient,
  q: string,
): Promise<CustomerSuggestion[]> {
  const { data, error } = await client.rpc('suggest_customers', { p_q: q, p_limit: 6 })
  throwIfError(error)
  return z.array(CustomerSuggestionSchema).parse(data)
}
