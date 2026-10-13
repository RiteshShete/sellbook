import { describe, expect, it } from 'vitest'
import { filterProducts, groupByCategory, moveId, normalizeSearch } from './categories'
import type { Category, Product } from './schemas'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const cat = (n: number, name: string, sort_order: number): Category => ({
  id: id(n),
  name,
  sort_order,
})
const product = (
  n: number,
  name: string,
  category_id: string | null,
  variants: string[] = [],
): Product => ({
  id: id(100 + n),
  name,
  sort_order: n,
  is_active: true,
  category_id,
  variants: variants.map((v, i) => ({
    id: id(200 + n * 10 + i),
    product_id: id(100 + n),
    name: v,
    price: 6000,
    cost_price: null,
    size_amount: null,
    size_unit: null,
    sort_order: i,
    is_active: true,
    deleted_at: null,
  })),
})

const cats = [cat(2, 'Mixes', 1), cat(1, 'Flours', 0)]
const products = [
  product(1, 'Modak Pith', id(1), ['Retail']),
  product(2, 'उपवास भाजणी', id(2), ['500 g']),
  product(3, 'कण्हेरी', null),
  product(4, 'राजगिरा पीठ', id(99)), // category no longer exists (trashed)
]

describe('groupByCategory', () => {
  it('follows category order and puts Uncategorised last', () => {
    const s = groupByCategory(products, cats)
    expect(s.map((x) => x.category?.name ?? null)).toEqual(['Flours', 'Mixes', null])
    expect(s[2]?.products.map((p) => p.name)).toEqual(['कण्हेरी', 'राजगिरा पीठ'])
  })

  it('starts empty: no categories means a single Uncategorised block', () => {
    const s = groupByCategory(products, [])
    expect(s).toHaveLength(1)
    expect(s[0]?.category).toBeNull()
    expect(s[0]?.products).toHaveLength(4)
  })

  it('leaves out empty sections', () => {
    expect(groupByCategory([], cats)).toEqual([])
  })
})

describe('filterProducts', () => {
  it('searches Devanagari and English, case-insensitively, by product or variant name', () => {
    expect(filterProducts(products, cats, 'MODAK', 'all').map((p) => p.name)).toEqual([
      'Modak Pith',
    ])
    expect(filterProducts(products, cats, 'भाजणी', 'all').map((p) => p.name)).toEqual([
      'उपवास भाजणी',
    ])
    expect(filterProducts(products, cats, 'retail', 'all').map((p) => p.name)).toEqual([
      'Modak Pith',
    ])
  })

  it('treats composed and decomposed Unicode alike', () => {
    expect(normalizeSearch('é')).toBe(normalizeSearch('é'))
  })

  it('filters by category and by Uncategorised (including products of a trashed category)', () => {
    expect(filterProducts(products, cats, '', id(1)).map((p) => p.name)).toEqual(['Modak Pith'])
    expect(filterProducts(products, cats, '', 'none').map((p) => p.name)).toEqual([
      'कण्हेरी',
      'राजगिरा पीठ',
    ])
  })

  it('combines text and category', () => {
    expect(filterProducts(products, cats, 'pith', id(2))).toEqual([])
  })
})

describe('moveId', () => {
  it('moves one step and stops at the ends', () => {
    expect(moveId(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveId(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
    expect(moveId(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(moveId(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
    expect(moveId(['a', 'b'], 'zzz', 1)).toEqual(['a', 'b'])
  })
})
