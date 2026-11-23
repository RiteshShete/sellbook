/**
 * Shop web addresses (/<slug>/products). The list below mirrors app_private.reserved_slugs() in
 * supabase/migrations/20261124100000_storefront_schema.sql; slug.test.ts fails if the two differ, and also fails
 * when an owner-app route is not reserved (a shop could otherwise take the address of one of our screens).
 */
export const RESERVED_SLUGS: readonly string[] = [
  'login', 'signup', 'forgot', 'reset-password', 'orders', 'delivery', 'analytics', 'products', 'catalog', 'pricing',
  'offers', 'more', 'settings', 'trash', 'activity', 'pending', 'plan', 'admin', 'terms', 'privacy', 'help', 'support',
  'api', 'app', 'assets', 'static', 'public', 's', 'shop', 'shops', 'store', 'www', 'mail', 'status', 'about', 'contact',
  'loyalty', 'customers', 'reports', 'account', 'cart', 'checkout', 'sellbook', 'null', 'undefined', 'test',
]

/** 3 to 30 characters: lower-case letters, digits and hyphens, not starting or ending with a hyphen. */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/

/** A readable reason the slug cannot be used, or null when it is fine (the server still checks uniqueness). */
export function slugProblem(slug: string): string | null {
  if (!SLUG_PATTERN.test(slug)) {
    return 'Use 3 to 30 lower-case letters, numbers or hyphens, not starting or ending with a hyphen.'
  }
  if (RESERVED_SLUGS.includes(slug)) return 'That address is reserved. Please choose another.'
  return null
}
