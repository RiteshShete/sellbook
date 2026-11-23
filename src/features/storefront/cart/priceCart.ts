import { orderTotals, type PricedVariant, type ShopRules, type Totals } from '../../../lib/pricing'
import type { Cart } from './cartStore'
import type { StoreCatalog, StoreProduct, StoreShop, StoreVariant } from '../types'

export type LineStatus = 'ok' | 'priceChanged' | 'unavailable'

export interface PricedLine {
  variantId: string
  qty: number
  status: LineStatus
  product: StoreProduct | null
  variant: StoreVariant | null
  /** The price now (offer when active), or 0 for an unavailable line. */
  unitPrice: number
  listPrice: number
}

/** Matches every cart line against the current catalogue: gone or sold out = unavailable; a different price = changed. */
export function priceCart(cart: Cart, catalog: StoreCatalog): PricedLine[] {
  const byVariant = new Map<string, { product: StoreProduct; variant: StoreVariant }>()
  for (const product of catalog.products) {
    for (const variant of product.variants) byVariant.set(variant.id, { product, variant })
  }
  return cart.lines.map((line) => {
    const hit = byVariant.get(line.variantId)
    if (!hit || !hit.product.is_available) {
      return { variantId: line.variantId, qty: line.qty, status: 'unavailable', product: hit?.product ?? null, variant: hit?.variant ?? null, unitPrice: 0, listPrice: 0 }
    }
    const unitPrice = hit.variant.effective_price
    return {
      variantId: line.variantId,
      qty: line.qty,
      status: unitPrice === line.seen ? 'ok' : 'priceChanged',
      product: hit.product,
      variant: hit.variant,
      unitPrice,
      listPrice: hit.variant.price,
    }
  })
}

export const shopRulesOf = (s: StoreShop): ShopRules => ({
  deliveryFee: s.delivery_fee,
  freeDeliveryAbove: s.free_delivery_above,
  minOrder: s.min_order,
})

/** The estimate shown before the server confirms it: buyable lines only, using the server's own current prices. */
export function estimateTotals(lines: PricedLine[], shop: StoreShop, fulfilment: 'delivery' | 'pickup'): Totals {
  const buyable = lines.filter((l) => l.status !== 'unavailable')
  return orderTotals(
    buyable.map((l) => ({
      variant: { price: l.listPrice, offer_price: l.unitPrice < l.listPrice ? l.unitPrice : null, offer_starts_at: null, offer_ends_at: null } satisfies PricedVariant,
      qty: l.qty,
    })),
    shopRulesOf(shop),
    fulfilment,
  )
}
