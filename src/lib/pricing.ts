import { addMoney, multiplyMoney, type Paise } from './money'

/**
 * What a customer pays. Mirrors the database (effective_price() and place_order), which is the authority: the browser
 * only previews. The shared fixtures (features/storefront/contract.fixtures.ts) run against both.
 */
export interface PricedVariant {
  price: Paise
  offer_price: Paise | null
  /** ISO instants; null = open-ended. The end is EXCLUSIVE (the next IST midnight after the last offer day). */
  offer_starts_at: string | null
  offer_ends_at: string | null
}

/** The offer price while inside its window, else the normal price. */
export function effectivePricePaise(v: PricedVariant, at: Date | number = Date.now()): Paise {
  const now = typeof at === 'number' ? at : at.getTime()
  if (v.offer_price === null) return v.price
  if (v.offer_starts_at !== null && now < Date.parse(v.offer_starts_at)) return v.price
  if (v.offer_ends_at !== null && now >= Date.parse(v.offer_ends_at)) return v.price
  return v.offer_price
}

export interface ShopRules {
  deliveryFee: Paise
  /** Delivery is free when the subtotal AFTER offers is at or above this. */
  freeDeliveryAbove: Paise | null
  minOrder: Paise
}

export interface Totals {
  subtotal: Paise
  offerSavings: Paise
  deliveryFee: Paise
  total: Paise
  belowMinimum: boolean
}

export function orderTotals(
  lines: { variant: PricedVariant; qty: number }[],
  shop: ShopRules,
  fulfilment: 'delivery' | 'pickup',
  at: Date | number = Date.now(),
): Totals {
  const now = effective(lines, at)
  const subtotal = addMoney(...now.map((l) => multiplyMoney(l.eff, l.qty)))
  const list = addMoney(...now.map((l) => multiplyMoney(l.variant.price, l.qty)))
  const free = shop.freeDeliveryAbove !== null && subtotal >= shop.freeDeliveryAbove
  const deliveryFee = fulfilment === 'pickup' || free ? 0 : shop.deliveryFee
  return {
    subtotal,
    offerSavings: list - subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    belowMinimum: subtotal < shop.minOrder,
  }
}

function effective(lines: { variant: PricedVariant; qty: number }[], at: Date | number) {
  return lines.map((l) => ({ ...l, eff: effectivePricePaise(l.variant, at) }))
}
