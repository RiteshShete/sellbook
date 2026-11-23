import { describe, expect, it } from 'vitest'
import {
  OFFER_WINDOW,
  OFFER_WINDOW_CASES,
  PRICING_CASES,
  PRICING_SHOP,
  VARIANT_A,
  VARIANT_B,
} from '../features/storefront/contract.fixtures'
import { effectivePricePaise, orderTotals, type PricedVariant } from './pricing'

const variantA = (offerActive: boolean): PricedVariant => ({
  price: VARIANT_A.normal,
  offer_price: offerActive ? VARIANT_A.offer : null,
  offer_starts_at: null,
  offer_ends_at: null,
})
const variantB: PricedVariant = { price: VARIANT_B.normal, offer_price: null, offer_starts_at: null, offer_ends_at: null }
const shop = { deliveryFee: PRICING_SHOP.deliveryFee, freeDeliveryAbove: PRICING_SHOP.freeDeliveryAbove, minOrder: PRICING_SHOP.minOrder }

describe('orderTotals agrees with the database fixtures (Appendix C)', () => {
  for (const c of PRICING_CASES) {
    if ('rejected' in c) continue
    it(`${c.id}`, () => {
      const lines = c.lines.map((l) => ({ variant: l.variant === 'A' ? variantA(l.offerActive) : variantB, qty: l.qty }))
      const t = orderTotals(lines, shop, c.fulfilment)
      expect({ subtotal: t.subtotal, savings: t.offerSavings, delivery: t.deliveryFee, total: t.total }).toEqual(c.expect)
      expect(t.belowMinimum).toBe(false)
    })
  }

  it('C5: one A is below the minimum order', () => {
    expect(orderTotals([{ variant: variantA(false), qty: 1 }], shop, 'delivery').belowMinimum).toBe(true)
  })

  it('a shop with no free-delivery threshold always charges the fee for delivery', () => {
    const t = orderTotals([{ variant: variantA(false), qty: 100 }], { ...shop, freeDeliveryAbove: null }, 'delivery')
    expect(t.deliveryFee).toBe(PRICING_SHOP.deliveryFee)
  })
})

describe('effectivePricePaise follows the IST offer window', () => {
  const windowed: PricedVariant = {
    price: OFFER_WINDOW.normal,
    offer_price: OFFER_WINDOW.offer,
    offer_starts_at: OFFER_WINDOW.startsAtUtc,
    offer_ends_at: OFFER_WINDOW.endsAtUtc,
  }
  it.each(OFFER_WINDOW_CASES)('$istLabel -> $expected paise', ({ atUtc, expected }) => {
    expect(effectivePricePaise(windowed, new Date(atUtc))).toBe(expected)
  })

  it('open-ended bounds', () => {
    const open = { ...windowed, offer_starts_at: null, offer_ends_at: null }
    expect(effectivePricePaise(open, 0)).toBe(OFFER_WINDOW.offer)
  })

  it('no offer price means the normal price', () => {
    expect(effectivePricePaise({ ...windowed, offer_price: null }, new Date(OFFER_WINDOW.startsAtUtc))).toBe(OFFER_WINDOW.normal)
  })
})
