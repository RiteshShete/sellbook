import { describe, expect, it } from 'vitest'
import { PRICING_CASES } from '../contract.fixtures'
import { V_CHAKLI, V_LADOO, V_SOLD_OUT, catalog, shop } from '../store.fixtures'
import { addLine, EMPTY_CART } from './cartStore'
import { estimateTotals, priceCart } from './priceCart'

describe('priceCart', () => {
  it('marks a line ok when the price is what the customer saw', () => {
    const lines = priceCart(addLine(EMPTY_CART, V_CHAKLI, 12000, 2), catalog())
    expect(lines[0]).toMatchObject({ status: 'ok', unitPrice: 12000, listPrice: 15000, qty: 2 })
  })

  it('marks "price updated" when the price now differs from the one seen', () => {
    expect(priceCart(addLine(EMPTY_CART, V_CHAKLI, 15000, 1), catalog())[0]?.status).toBe('priceChanged')
  })

  it('marks a sold-out product and a variant that no longer exists as unavailable', () => {
    const cart = addLine(addLine(EMPTY_CART, V_SOLD_OUT, 8000), '99999999-9999-4999-8999-999999999999', 100)
    expect(priceCart(cart, catalog()).map((l) => l.status)).toEqual(['unavailable', 'unavailable'])
  })
})

describe('estimateTotals (same rules as the database)', () => {
  it('C1/C2: 2 x Chakli at the offer = 240 + 40 delivery = 280', () => {
    const lines = priceCart(addLine(EMPTY_CART, V_CHAKLI, 12000, 2), catalog())
    const t = estimateTotals(lines, shop(), 'delivery')
    expect({ subtotal: t.subtotal, savings: t.offerSavings, delivery: t.deliveryFee, total: t.total }).toEqual(
      PRICING_CASES.find((c) => c.id === 'C2' && 'expect' in c && c.expect)?.['expect' as never],
    )
  })

  it('leaves unavailable lines out of the estimate', () => {
    const cart = addLine(addLine(EMPTY_CART, V_LADOO, 10000, 3), V_SOLD_OUT, 8000, 5)
    const t = estimateTotals(priceCart(cart, catalog()), shop(), 'delivery')
    expect(t.subtotal).toBe(30000)
  })

  it('pickup has no delivery fee; free delivery applies from the threshold', () => {
    const lines = priceCart(addLine(EMPTY_CART, V_LADOO, 10000, 5), catalog())
    expect(estimateTotals(lines, shop(), 'delivery').deliveryFee).toBe(0) // 500 is the threshold, inclusive
    expect(estimateTotals(priceCart(addLine(EMPTY_CART, V_LADOO, 10000, 2), catalog()), shop(), 'pickup').deliveryFee).toBe(0)
  })

  it('flags an order below the shop minimum', () => {
    expect(estimateTotals(priceCart(addLine(EMPTY_CART, V_LADOO, 10000, 1), catalog()), shop(), 'delivery').belowMinimum).toBe(true)
  })
})
