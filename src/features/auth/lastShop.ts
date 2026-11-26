const LAST_SHOP_KEY = 'sb:lastShop'

/** The shop the person last visited as a customer, to offer a way back. Storage may be blocked: then none. */
export function lastShop(): string | null {
  try {
    const slug = window.localStorage.getItem(LAST_SHOP_KEY)
    return slug && /^[a-z0-9-]{3,30}$/.test(slug) ? slug : null
  } catch {
    return null
  }
}

export function rememberShop(slug: string): void {
  try {
    window.localStorage.setItem(LAST_SHOP_KEY, slug)
  } catch {
    // storage blocked (private window): the way back is just not offered
  }
}
