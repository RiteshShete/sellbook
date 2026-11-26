import type { SupabaseClient } from '@supabase/supabase-js'
import { CreateShopRequest, SlugAvailableResponse } from '../storefront/contract'

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1) + (text.endsWith('.') ? '' : '.')

/** Is this web address free? (Format and reserved words are checked on the screen first; this asks the server.) */
export async function isSlugAvailable(client: SupabaseClient, slug: string): Promise<boolean> {
  const { data, error } = await client.rpc('slug_available', { p_slug: slug })
  if (error) throw new Error(error.message)
  return SlugAvailableResponse.parse(data)
}

/**
 * Creates the signed-in person's shop. Needs an invite code during the pilot. The server's sentences here are written
 * for the shop owner ("this invite code isn't valid", "that web address is not available"), so they are shown as they are.
 */
export async function createShop(
  client: SupabaseClient,
  input: { invite: string; slug: string; name: string },
): Promise<{ slug: string }> {
  const request = CreateShopRequest.parse({ p_invite: input.invite.trim(), p_slug: input.slug, p_name: input.name.trim() })
  const { data, error } = await client.rpc('create_shop', request)
  if (error) throw new Error(sentence(error.message))
  const slug = (data as { slug?: unknown } | null)?.slug
  return { slug: typeof slug === 'string' ? slug : input.slug }
}
