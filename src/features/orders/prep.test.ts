import { describe, expect, it } from 'vitest'
import { PrepListSchema } from './prep'

describe('PrepListSchema', () => {
  it('parses the prep_list() response', () => {
    const list = PrepListSchema.parse({
      orders: 2,
      products: [
        {
          key: 'p1',
          name: 'Cake',
          quantity: 6,
          orders: 2,
          grams: 5500,
          ml: 0,
          pieces: 0,
          unsized: 0,
          variants: [
            {
              key: 'v1',
              name: '500 g',
              quantity: 1,
              orders: 1,
              grams: 500,
              ml: 0,
              pieces: 0,
              unsized: 0,
            },
            {
              key: 'v2',
              name: '1 kg',
              quantity: 5,
              orders: 2,
              grams: '5000.000',
              ml: 0,
              pieces: 0,
              unsized: 0,
            },
          ],
        },
      ],
    })
    expect(list.products[0]?.variants.map((v) => v.quantity)).toEqual([1, 5])
    // numeric(12,3) may arrive as a string; it becomes a number.
    expect(list.products[0]?.variants.map((v) => v.grams)).toEqual([500, 5000])
  })
  it('accepts an empty list', () => {
    expect(PrepListSchema.parse({ orders: 0, products: [] }).products).toEqual([])
  })
  it('rejects negative or fractional quantities', () => {
    const bad = (quantity: number) =>
      PrepListSchema.safeParse({
        orders: 1,
        products: [
          {
            key: 'p',
            name: 'X',
            quantity,
            orders: 1,
            grams: 0,
            ml: 0,
            pieces: 0,
            unsized: 0,
            variants: [],
          },
        ],
      }).success
    expect(bad(-1)).toBe(false)
    expect(bad(1.5)).toBe(false)
  })
})
