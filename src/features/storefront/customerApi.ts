import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { RegisterCustomerRequest } from './contract'

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1) + (text.endsWith('.') ? '' : '.')

const ProfileSchema = z.object({ name: z.string(), phone: z.string() })
export type CustomerProfile = z.infer<typeof ProfileSchema>

/**
 * Creates the signed-in person's customer profile (name + mobile). The server's sentences here are written for the
 * customer ("this mobile number is already registered", "use the mobile number you signed up with").
 * `phone` is digits with country code, e.g. 919876543210.
 */
export async function registerCustomer(client: SupabaseClient, input: { name: string; phone: string }): Promise<void> {
  const request = RegisterCustomerRequest.parse({ p_name: input.name.trim(), p_phone: input.phone })
  const { error } = await client.rpc('register_customer', request)
  if (error) throw new Error(sentence(error.message))
}

/** Changes the signed-in customer's name and mobile (digits with country code). Past orders keep what they were placed with. */
export async function updateMyProfile(client: SupabaseClient, input: { name: string; phone: string }): Promise<void> {
  const request = RegisterCustomerRequest.parse({ p_name: input.name.trim(), p_phone: input.phone })
  const { error } = await client.rpc('update_my_profile', request)
  if (error) throw new Error(sentence(error.message))
}

/** The signed-in customer's own profile (row-level security shows only this person's row). */
export async function fetchCustomerProfile(client: SupabaseClient): Promise<CustomerProfile | null> {
  const { data, error } = await client.from('customer_profiles').select('name, phone').maybeSingle()
  if (error) throw new Error(error.message)
  return data === null ? null : ProfileSchema.parse(data)
}

/** Files the request; nothing is deleted automatically (the shop keeps order records for its books). */
export async function requestAccountDeletion(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('request_account_deletion')
  if (error) throw new Error(error.message)
}
