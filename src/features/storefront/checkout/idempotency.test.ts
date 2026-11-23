import { describe, expect, it } from 'vitest'
import { clearOrderKey, orderKeyFor } from './idempotency'

function memory() {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) }
}
const counter = () => {
  let n = 0
  return () => `key-${++n}`
}

describe('orderKeyFor', () => {
  it('gives the SAME key for the same cart, so a double tap or a retry is one order', () => {
    const s = memory()
    const make = counter()
    const first = orderKeyFor(s, 'a-foods', 'cart-1', make)
    expect(orderKeyFor(s, 'a-foods', 'cart-1', make)).toBe(first)
    expect(orderKeyFor(s, 'a-foods', 'cart-1', make)).toBe(first)
  })

  it('gives a new key when the cart changes', () => {
    const s = memory()
    const make = counter()
    const first = orderKeyFor(s, 'a-foods', 'cart-1', make)
    expect(orderKeyFor(s, 'a-foods', 'cart-2', make)).not.toBe(first)
  })

  it('keeps shops apart, and starts again after the key is cleared', () => {
    const s = memory()
    const make = counter()
    const a = orderKeyFor(s, 'a-foods', 'cart-1', make)
    expect(orderKeyFor(s, 'b-sweets', 'cart-1', make)).not.toBe(a)
    clearOrderKey(s, 'a-foods')
    expect(orderKeyFor(s, 'a-foods', 'cart-1', make)).not.toBe(a)
  })

  it('survives unreadable or blocked storage', () => {
    const make = counter()
    expect(orderKeyFor(null, 'a', 'x', make)).toBe('key-1')
    expect(orderKeyFor(memory(), 'a', 'x', make)).toBe('key-2')
    const junk = { getItem: () => 'not json', setItem: () => { throw new Error('full') }, removeItem: () => { throw new Error('full') } }
    expect(orderKeyFor(junk, 'a', 'x', make)).toBe('key-3')
    expect(() => clearOrderKey(junk, 'a')).not.toThrow()
  })
})
