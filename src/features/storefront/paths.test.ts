import { describe, expect, it } from 'vitest'
import { getShopKey, safeShopReturn, storefrontPath } from './paths'

describe('storefront paths', () => {
  it('builds links', () => {
    expect(storefrontPath('ritesh-foods')).toBe('/ritesh-foods/products')
    expect(storefrontPath('ritesh-foods', 'cart')).toBe('/ritesh-foods/cart')
  })

  it('finds the shop key', () => {
    expect(getShopKey('/ritesh-foods/products/123')).toBe('ritesh-foods')
    expect(getShopKey('/')).toBeNull()
  })

  it('returns only to the same shop', () => {
    expect(safeShopReturn('a-foods', '/a-foods/checkout')).toBe('/a-foods/checkout')
    expect(safeShopReturn('a-foods', '/b-sweets/checkout')).toBe('/a-foods/products')
    expect(safeShopReturn('a-foods', '//evil.com')).toBe('/a-foods/products')
    expect(safeShopReturn('a-foods', '/a-foods/../login')).toBe('/a-foods/products')
    expect(safeShopReturn('a-foods', undefined)).toBe('/a-foods/products')
  })
})
