/** One place that builds storefront links and finds the shop in the address (today: the first path segment). */
export type StorefrontPage = 'products' | 'cart' | 'checkout' | 'orders' | 'login' | 'signup' | 'forgot' | 'account'

export const storefrontPath = (slug: string, page: StorefrontPage = 'products') => `/${slug}/${page}`

/** The shop in a path like "/ritesh-foods/products". Later this can read the hostname (subdomains). */
export function getShopKey(pathname: string): string | null {
  return pathname.split('/').filter(Boolean)[0] ?? null
}

/** After login, go back only to a page of the SAME shop (no open redirects). */
export function safeShopReturn(slug: string, target: unknown): string {
  const ok =
    typeof target === 'string' && target.startsWith(`/${slug}/`) && !target.startsWith('//') && !target.includes('..')
  return ok ? target : storefrontPath(slug)
}
