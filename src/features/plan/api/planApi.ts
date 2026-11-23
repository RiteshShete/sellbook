import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { throwIfError } from '../../../lib/dbError'
import { PlanLimitSchema, PlanSchema, type Plan, type PlanLimit } from '../schemas'

export async function fetchPlan(client: SupabaseClient): Promise<Plan> {
  const { data, error } = await client.rpc('my_plan')
  throwIfError(error)
  return PlanSchema.parse(data)
}

/** "I have paid": files a request the platform admin approves by hand. `utr` is the optional bank reference. */
export async function requestSubscription(
  client: SupabaseClient,
  tier: 'base' | 'pro',
  utr: string,
): Promise<void> {
  const { error } = await client.rpc('request_subscription', { p_tier: tier, p_utr: utr || null })
  throwIfError(error)
}

export async function cancelSubscriptionRequest(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('cancel_subscription_request')
  throwIfError(error)
}

/** Everything the shop has entered, as one JSON document (products, orders, bills, settings). */
export async function exportMyData(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.rpc('export_my_data')
  throwIfError(error)
  return JSON.stringify(z.looseObject({}).parse(data), null, 2)
}

/** Every tier, cheapest first. */
export async function fetchPlanLimits(client: SupabaseClient): Promise<PlanLimit[]> {
  const { data, error } = await client.from('plan_limits').select('*').order('price_paise')
  throwIfError(error)
  return z.array(PlanLimitSchema).parse(data)
}
