import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { throwIfError } from '../../lib/dbError'
import { TIERS } from '../plan/schemas'

export const REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

/** One row of admin_list_requests(): a shop's payment claim, with who it is and what plan it has now. */
export const AdminRequestSchema = z.object({
  id: z.guid(),
  owner_id: z.guid(),
  email: z.string(),
  shop_name: z.string(),
  tier: z.enum(['base', 'pro']),
  amount_paise: z.number().int(),
  ref_code: z.string(),
  utr: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
  decided_at: z.string().nullable(),
  reject_reason: z.string().nullable(),
  current_tier: z.enum(TIERS).nullable(),
  current_ends_at: z.string().nullable(),
})
export type AdminRequest = z.infer<typeof AdminRequestSchema>

/** One row of admin_list_shops(): a shop, its plan, and whether that plan has no end. */
export const AdminShopSchema = z.object({
  owner_id: z.guid(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  shop_name: z.string(),
  tier: z.enum(TIERS),
  status: z.enum(['trial', 'active', 'grace_readonly', 'locked']),
  ends_at: z.string(),
  lifetime: z.boolean(),
  orders_this_month: z.number().int(),
  created_at: z.string(),
})
export type AdminShop = z.infer<typeof AdminShopSchema>

export async function fetchAdminShops(client: SupabaseClient, query: string): Promise<AdminShop[]> {
  const { data, error } = await client.rpc('admin_list_shops', { p_query: query.trim() || null })
  throwIfError(error)
  return z.array(AdminShopSchema).parse(data)
}

/** lifetime = no end; days = 0 ends the plan now. The server checks the caller is a platform admin. */
export async function setSubscription(
  client: SupabaseClient,
  v: { owner: string; tier: (typeof TIERS)[number]; days: number; lifetime: boolean },
): Promise<void> {
  const { error } = await client.rpc('admin_set_subscription', {
    p_owner: v.owner,
    p_tier: v.tier,
    p_days: v.days,
    p_lifetime: v.lifetime,
  })
  throwIfError(error)
}

/** The free Supabase plan's ceilings (the limits the platform has to stay inside). */
export const FREE_DB_BYTES = 500 * 1024 * 1024
export const FREE_STORAGE_BYTES = 1024 * 1024 * 1024

/** admin_stats(): how many shops, and how full the free plan is. */
export const AdminStatsSchema = z.object({
  shops: z.object({
    total: z.number().int(),
    trial: z.number().int(),
    base: z.number().int(),
    pro: z.number().int(),
    ended: z.number().int(),
  }),
  orders: z.number().int(),
  pending_requests: z.number().int(),
  db_bytes: z.number().int(),
  bill_bytes: z.number().int(),
  asset_bytes: z.number().int(),
})
export type AdminStats = z.infer<typeof AdminStatsSchema>

export type ConfigKey = 'upi_id' | 'payee_name' | 'support_email'

/** Only decides what the app shows; every admin function checks again on the server. */
export async function fetchIsAdmin(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.rpc('is_admin')
  throwIfError(error)
  return z.boolean().parse(data)
}

export async function fetchAdminRequests(
  client: SupabaseClient,
  status: RequestStatus,
): Promise<AdminRequest[]> {
  const { data, error } = await client.rpc('admin_list_requests', { p_status: status })
  throwIfError(error)
  return z.array(AdminRequestSchema).parse(data)
}

/** Approve (the shop's plan starts or extends) or reject with a reason the shop will see. */
export async function decideRequest(
  client: SupabaseClient,
  id: string,
  approve: boolean,
  reason: string,
): Promise<void> {
  const { error } = await client.rpc('admin_decide_request', {
    p_id: id,
    p_approve: approve,
    p_reason: reason || null,
  })
  throwIfError(error)
}

export async function setConfig(client: SupabaseClient, key: ConfigKey, value: string): Promise<void> {
  const { error } = await client.rpc('admin_set_config', { p_key: key, p_value: value })
  throwIfError(error)
}

export async function fetchAdminStats(client: SupabaseClient): Promise<AdminStats> {
  const { data, error } = await client.rpc('admin_stats')
  throwIfError(error)
  return AdminStatsSchema.parse(data)
}

/** 'warn' from 70%: time to clear space or move to a paid Supabase plan before it fills. */
export function fillLevel(used: number, cap: number): 'ok' | 'warn' | 'full' {
  const ratio = used / cap
  return ratio >= 1 ? 'full' : ratio >= 0.7 ? 'warn' : 'ok'
}
