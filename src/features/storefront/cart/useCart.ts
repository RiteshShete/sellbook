import { useSyncExternalStore } from 'react'
import { addLine, EMPTY_CART, loadCart, removeLine, saveCart, setQty, type Cart } from './cartStore'

/**
 * One shared cart per shop, so the product page, the cart bar and the cart page always agree. The cart lives in
 * localStorage (when it is blocked, in memory for this tab).
 */
const carts = new Map<string, Cart>()
const listeners = new Set<() => void>()

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function read(slug: string): Cart {
  let cart = carts.get(slug)
  if (!cart) {
    cart = loadCart(storage(), slug)
    carts.set(slug, cart)
  }
  return cart
}

function write(slug: string, cart: Cart) {
  carts.set(slug, cart)
  saveCart(storage(), slug, cart)
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}

export function useCart(slug: string) {
  const cart = useSyncExternalStore(subscribe, () => read(slug), () => EMPTY_CART)
  return {
    cart,
    add: (variantId: string, price: number, qty = 1) => write(slug, addLine(read(slug), variantId, price, qty)),
    set: (variantId: string, qty: number, price?: number) => write(slug, setQty(read(slug), variantId, qty, price)),
    remove: (variantId: string) => write(slug, removeLine(read(slug), variantId)),
    clear: () => write(slug, EMPTY_CART),
  }
}
