import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { throwIfError } from '../../../lib/dbError'
import { actionReasons, NEEDS_ACTION_FILTER } from '../customerOrders'
import { OrderListRowSchema, OrderSchema, type Order, type OrderListRow } from '../schemas'

/** Customer orders that wait for the shop, newest first. The database narrows it; the rules decide the rest. */
export async function fetchNeedsAction(client: SupabaseClient): Promise<OrderListRow[]> {
  const { data, error } = await client
    .from('orders')
    .select('*, order_items (quantity, product_name, variant_name, position, size_amount, size_unit)')
    .is('deleted_at', null)
    .eq('source', 'customer')
    .or(NEEDS_ACTION_FILTER)
    .order('created_at', { ascending: false })
    .limit(100)
  throwIfError(error)
  return z
    .array(OrderListRowSchema)
    .parse(data)
    .filter((o) => actionReasons(o).length > 0)
}

export async function confirmOrder(client: SupabaseClient, id: string, note: string, version: number): Promise<Order> {
  const { data, error } = await client.rpc('confirm_order', { p_id: id, p_note: note.trim() || null, v: version })
  throwIfError(error)
  return OrderSchema.parse(data)
}

/** `refund_needed` is true when the order was already paid or the customer said they had paid. */
export async function declineOrder(client: SupabaseClient, id: string, reason: string, version: number): Promise<boolean> {
  const { data, error } = await client.rpc('decline_order', { p_id: id, p_reason: reason.trim(), v: version })
  throwIfError(error)
  return z.object({ refund_needed: z.boolean() }).parse(data).refund_needed
}

/** Remembers that the shop paid the customer back by hand (the app moves no money). */
export async function markRefunded(client: SupabaseClient, id: string, version: number): Promise<void> {
  const { error } = await client.rpc('mark_refunded', { p_id: id, v: version })
  throwIfError(error)
}

/** Marks the order paid by UPI (the owner has seen the money in the bank). Returns the other order using the same UTR, if any. */
export async function verifyPayment(client: SupabaseClient, id: string, version: number): Promise<number | null> {
  const { data, error } = await client.rpc('verify_payment', { p_id: id, v: version })
  throwIfError(error)
  return z.object({ duplicate_utr_order_no: z.number().int().nullable() }).parse(data).duplicate_utr_order_no
}

export async function rejectPayment(client: SupabaseClient, id: string, reason: string, version: number): Promise<void> {
  const { error } = await client.rpc('reject_payment', { p_id: id, p_reason: reason.trim(), v: version })
  throwIfError(error)
}

/** Other orders of this shop that carry the same UTR (shown as a warning before the owner verifies). */
export async function fetchOrdersWithUtr(client: SupabaseClient, id: string, reference: string): Promise<number[]> {
  const { data, error } = await client
    .from('orders')
    .select('order_no')
    .eq('payment_reference', reference)
    .neq('id', id)
    .is('deleted_at', null)
  throwIfError(error)
  return z.array(z.object({ order_no: z.number().int() })).parse(data).map((o) => o.order_no)
}
