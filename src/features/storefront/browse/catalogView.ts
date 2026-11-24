import { offerState } from '../../../lib/offers'
import { normalizeSearch } from '../../../lib/search'
import type { StoreCatalog, StoreProduct } from '../types'

/** The lowest price a customer would pay for any variant now ("from ₹60"), or null when none can be sold. */
export function fromPriceOf(p: StoreProduct): number | null {
  const prices = p.variants.map((v) => v.effective_price)
  return prices.length > 0 ? Math.min(...prices) : null
}

/** The variant with the biggest saving, for the card's offer badge. */
export function bestOffer(p: StoreProduct): { label: string; hint: string } | null {
  const offers = p.variants.filter((v) => v.offer_price !== null && v.effective_price < v.price)
  if (offers.length === 0) return null
  const best = offers.reduce((a, b) => (b.price - b.effective_price > a.price - a.effective_price ? b : a))
  const state = offerState({ offer_price: best.offer_price, offer_starts_at: null, offer_ends_at: best.offer_ends_at })
  return { label: best.offer_label ?? 'Offer', hint: state.hint }
}

/** Products matching the search text (product or variant name) and the category chip ('all', 'none' or an id). */
export function filterProducts(catalog: StoreCatalog, query: string, category: string): StoreProduct[] {
  const q = normalizeSearch(query)
  const known = new Set(catalog.categories.map((c) => c.id))
  return catalog.products.filter((p) => {
    if (category === 'none' && p.category_id !== null && known.has(p.category_id)) return false
    if (category !== 'all' && category !== 'none' && p.category_id !== category) return false
    if (q === '') return true
    return normalizeSearch(p.name).includes(q) || p.variants.some((v) => normalizeSearch(v.name).includes(q))
  })
}

/** How many products the grid draws at first and per "Show more" (the whole list is already loaded; this keeps the page light). */
export const PAGE_SIZE = 24

/** The first `pages` pages of a list, and whether more remain. */
export function firstPages<T>(list: readonly T[], pages: number): { items: T[]; more: boolean } {
  const n = Math.max(1, pages) * PAGE_SIZE
  return { items: list.slice(0, n), more: list.length > n }
}

