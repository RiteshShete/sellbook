import { describe, expect, it } from 'vitest'
import type { StoreProduct } from '../types'
import { CAT_SNACKS, catalog } from '../store.fixtures'
import { bestOffer, filterProducts, firstPages, fromPriceOf } from './catalogView'

const names = (c: ReturnType<typeof catalog>, q: string, cat = 'all') => filterProducts(c, q, cat).map((p) => p.name)

describe('fromPriceOf and bestOffer', () => {
  it('uses the price a customer would pay now', () => {
    expect(fromPriceOf((catalog().products[0] as StoreProduct))).toBe(12000)
    expect(fromPriceOf({ ...(catalog().products[0] as StoreProduct), variants: [] })).toBeNull()
  })
  it('shows the offer label with its end hint, and nothing for a product without an offer', () => {
    expect(bestOffer((catalog().products[0] as StoreProduct))).toMatchObject({ label: 'Diwali offer' })
    expect(bestOffer((catalog().products[1] as StoreProduct))).toBeNull()
  })
})

describe('filterProducts', () => {
  it('shows everything with no search and the "all" chip', () => {
    expect(names(catalog(), '')).toEqual(['Chakli', 'Ladoo', 'Shankarpali'])
  })
  it('searches the product name without caring about case', () => {
    expect(names(catalog(), 'CHAK')).toEqual(['Chakli'])
  })
  it('also searches variant names', () => {
    expect(names(catalog(), 'box')).toEqual(['Ladoo'])
  })
  it('filters by category chip, and "none" means uncategorised', () => {
    expect(names(catalog(), '', CAT_SNACKS)).toEqual(['Ladoo'])
    expect(names(catalog(), '', 'none')).toEqual(['Chakli', 'Shankarpali'])
  })
  it('treats a product whose category is unknown as uncategorised', () => {
    const c = catalog()
    const odd = { ...c, products: c.products.map((p) => ({ ...p, category_id: '55555555-5555-4555-8555-555555555555' })) }
    expect(names(odd, '', 'none')).toHaveLength(3)
  })
  it('matches Marathi text typed in either Unicode form', () => {
    const c = catalog()
    const marathi = { ...c, products: [{ ...(c.products[0] as StoreProduct), name: 'कण्हेरी' }] }
    expect(names(marathi, 'कण्हेरी'.normalize('NFD'))).toEqual(['कण्हेरी'])
  })
})

describe('firstPages', () => {
  const list = Array.from({ length: 60 }, (_, i) => i)
  it('draws one page, then more on request, and says when nothing remains', () => {
    expect(firstPages(list, 1)).toEqual({ items: list.slice(0, 24), more: true })
    expect(firstPages(list, 2).items).toHaveLength(48)
    expect(firstPages(list, 3)).toEqual({ items: list, more: false })
  })
  it('handles short and empty lists and a bad page count', () => {
    expect(firstPages([1, 2], 1)).toEqual({ items: [1, 2], more: false })
    expect(firstPages([], 1)).toEqual({ items: [], more: false })
    expect(firstPages(list, 0).items).toHaveLength(24)
  })
})
