import { z } from 'zod'
import { LIMITS } from '../contract'

/**
 * The customer's cart: variant ids and quantities only (prices always come from the server). `seen` is the price the
 * customer saw when adding, so a later change can be shown as "Price updated". Stored per shop in localStorage; Safari
 * may clear it after a week without a visit, which is acceptable.
 */
const LineSchema = z.object({
  variantId: z.guid(),
  qty: z.number().int().min(1).max(LIMITS.maxQty),
  seen: z.number().int().nonnegative(),
})
const CartSchema = z.object({ v: z.literal(1), lines: z.array(LineSchema).max(LIMITS.maxLines) })

export type CartLine = z.infer<typeof LineSchema>
export interface Cart {
  lines: CartLine[]
}

export const EMPTY_CART: Cart = { lines: [] }
export const cartKey = (slug: string) => `sb:cart:${slug}`

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** A damaged, old or unreadable cart is simply an empty one: the cart must never break the page. */
export function loadCart(storage: StorageLike | null, slug: string): Cart {
  try {
    const raw = storage?.getItem(cartKey(slug))
    if (!raw) return EMPTY_CART
    const parsed = CartSchema.safeParse(JSON.parse(raw))
    return parsed.success ? { lines: parsed.data.lines } : EMPTY_CART
  } catch {
    return EMPTY_CART
  }
}

export function saveCart(storage: StorageLike | null, slug: string, cart: Cart): void {
  try {
    if (cart.lines.length === 0) storage?.removeItem(cartKey(slug))
    else storage?.setItem(cartKey(slug), JSON.stringify({ v: 1, lines: cart.lines }))
  } catch {
    // storage full or blocked: the cart lives only in this tab then
  }
}

/** Adds `qty` of a variant (merging with an existing line); caps one line at 50 and the cart at 30 lines. */
export function addLine(cart: Cart, variantId: string, price: number, qty = 1): Cart {
  const existing = cart.lines.find((l) => l.variantId === variantId)
  if (existing) {
    return setQty(cart, variantId, existing.qty + qty, price)
  }
  if (cart.lines.length >= LIMITS.maxLines) return cart
  return { lines: [...cart.lines, { variantId, qty: Math.min(LIMITS.maxQty, Math.max(1, qty)), seen: price }] }
}

/** Sets a quantity (0 removes the line). `price` refreshes the price the customer last saw. */
export function setQty(cart: Cart, variantId: string, qty: number, price?: number): Cart {
  if (qty <= 0) return removeLine(cart, variantId)
  return {
    lines: cart.lines.map((l) =>
      l.variantId === variantId ? { ...l, qty: Math.min(LIMITS.maxQty, qty), seen: price ?? l.seen } : l,
    ),
  }
}

export const removeLine = (cart: Cart, variantId: string): Cart => ({
  lines: cart.lines.filter((l) => l.variantId !== variantId),
})

export const cartCount = (cart: Cart): number => cart.lines.reduce((n, l) => n + l.qty, 0)

/** The same cart always gives the same text (order of lines ignored): used to decide when a new order key is needed. */
export const cartSignature = (cart: Cart): string =>
  JSON.stringify([...cart.lines].sort((a, b) => a.variantId.localeCompare(b.variantId)).map((l) => [l.variantId, l.qty]))
