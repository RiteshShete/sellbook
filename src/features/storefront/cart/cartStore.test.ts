import { describe, expect, it } from 'vitest'
import {
  EMPTY_CART,
  addLine,
  cartCount,
  cartKey,
  cartSignature,
  loadCart,
  removeLine,
  saveCart,
  setQty,
} from './cartStore'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

describe('cart changes', () => {
  it('adds a line and merges the same variant', () => {
    let cart = addLine(EMPTY_CART, A, 15000, 2)
    cart = addLine(cart, A, 15000, 3)
    expect(cart.lines).toEqual([{ variantId: A, qty: 5, seen: 15000 }])
  })

  it('caps one line at 50', () => {
    expect(addLine(addLine(EMPTY_CART, A, 100, 40), A, 100, 40).lines[0]?.qty).toBe(50)
  })

  it('caps the cart at 30 lines and ignores more', () => {
    let cart = EMPTY_CART
    for (let i = 0; i < 31; i++) cart = addLine(cart, `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, 100)
    expect(cart.lines).toHaveLength(30)
  })

  it('sets a quantity, and zero removes the line', () => {
    const cart = addLine(addLine(EMPTY_CART, A, 100), B, 200)
    expect(setQty(cart, A, 4).lines.find((l) => l.variantId === A)?.qty).toBe(4)
    expect(setQty(cart, A, 0).lines.map((l) => l.variantId)).toEqual([B])
    expect(removeLine(cart, B).lines.map((l) => l.variantId)).toEqual([A])
  })

  it('refreshes the price the customer saw when asked', () => {
    expect(setQty(addLine(EMPTY_CART, A, 100), A, 1, 90).lines[0]?.seen).toBe(90)
  })

  it('counts items', () => {
    expect(cartCount(addLine(addLine(EMPTY_CART, A, 100, 2), B, 100, 3))).toBe(5)
  })
})

describe('cartSignature', () => {
  it('ignores line order and the seen price, but not quantities', () => {
    const one = addLine(addLine(EMPTY_CART, A, 100, 2), B, 100, 1)
    const two = addLine(addLine(EMPTY_CART, B, 999, 1), A, 999, 2)
    expect(cartSignature(one)).toBe(cartSignature(two))
    expect(cartSignature(setQty(one, A, 3))).not.toBe(cartSignature(one))
  })
})

describe('storage', () => {
  it('saves and loads per shop', () => {
    const s = memoryStorage()
    saveCart(s, 'a-foods', addLine(EMPTY_CART, A, 100, 2))
    expect(loadCart(s, 'a-foods').lines).toHaveLength(1)
    expect(loadCart(s, 'b-sweets').lines).toHaveLength(0)
  })

  it('removes the key when the cart becomes empty', () => {
    const s = memoryStorage()
    saveCart(s, 'a-foods', addLine(EMPTY_CART, A, 100))
    saveCart(s, 'a-foods', EMPTY_CART)
    expect(s.data.has(cartKey('a-foods'))).toBe(false)
  })

  it.each([
    ['not json', 'nope'],
    ['wrong version', JSON.stringify({ v: 2, lines: [] })],
    ['bad variant id', JSON.stringify({ v: 1, lines: [{ variantId: 'x', qty: 1, seen: 1 }] })],
    ['qty 0', JSON.stringify({ v: 1, lines: [{ variantId: A, qty: 0, seen: 1 }] })],
    ['qty 51', JSON.stringify({ v: 1, lines: [{ variantId: A, qty: 51, seen: 1 }] })],
  ])('treats a damaged cart (%s) as empty', (_why, raw) => {
    expect(loadCart(memoryStorage({ [cartKey('s')]: raw }), 's').lines).toEqual([])
  })

  it('works with no storage at all, and when storage throws', () => {
    expect(loadCart(null, 's')).toEqual(EMPTY_CART)
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
    expect(loadCart(broken, 's')).toEqual(EMPTY_CART)
    expect(() => saveCart(broken, 's', addLine(EMPTY_CART, A, 1))).not.toThrow()
  })
})
