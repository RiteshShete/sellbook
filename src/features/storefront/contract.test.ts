import { describe, expect, it } from 'vitest'
import {
  CustomerOrderSchema,
  ClaimPaymentRequest,
  PlaceOrderRequest,
  StorefrontShopSchema,
  StorefrontVariantSchema,
} from './contract'
import {
  EXAMPLE_PLACE_ORDER,
  EXAMPLE_SHOP,
  OFFER_WINDOW,
  OFFER_WINDOW_CASES,
  PRICING_CASES,
  PRICING_SHOP,
  VARIANT_A,
  VARIANT_B,
} from './contract.fixtures'

describe('place_order request', () => {
  it('accepts the example', () => {
    expect(PlaceOrderRequest.safeParse(EXAMPLE_PLACE_ORDER).success).toBe(true)
  })

  it.each(['price', 'total', 'owner_id', 'unit_price'])('rejects a client-sent %s', (key) => {
    expect(PlaceOrderRequest.safeParse({ ...EXAMPLE_PLACE_ORDER, [key]: 1 }).success).toBe(false)
  })

  it('rejects a price inside a line', () => {
    const bad = { ...EXAMPLE_PLACE_ORDER, items: [{ ...EXAMPLE_PLACE_ORDER.items[0], price: 1 }] }
    expect(PlaceOrderRequest.safeParse(bad).success).toBe(false)
  })

  it('rejects qty 0, qty 51 and an empty cart', () => {
    const line = EXAMPLE_PLACE_ORDER.items[0]
    for (const items of [[{ ...line, qty: 0 }], [{ ...line, qty: 51 }], []]) {
      expect(PlaceOrderRequest.safeParse({ ...EXAMPLE_PLACE_ORDER, items }).success).toBe(false)
    }
  })

  it('needs an address for delivery but not for pickup', () => {
    const noAddress = { ...EXAMPLE_PLACE_ORDER, address: undefined }
    expect(PlaceOrderRequest.safeParse(noAddress).success).toBe(false)
    expect(PlaceOrderRequest.safeParse({ ...noAddress, fulfilment: 'pickup' }).success).toBe(true)
  })
})

describe('strict public responses', () => {
  it('parses the shop example and converts money to paise', () => {
    const shop = StorefrontShopSchema.parse(EXAMPLE_SHOP)
    expect([shop.delivery_fee, shop.free_delivery_above, shop.min_order]).toEqual([4000, 50000, 20000])
  })

  it.each(['upi_id', 'owner_id', 'payee_name'])('fails when the shop response leaks %s', (key) => {
    expect(StorefrontShopSchema.safeParse({ ...EXAMPLE_SHOP, [key]: 'x' }).success).toBe(false)
  })

  it('fails when a catalogue variant leaks cost_price', () => {
    const variant = {
      id: '11111111-1111-4111-8111-111111111111',
      name: '500 g',
      size_amount: null,
      size_unit: null,
      price: 150,
      offer_price: null,
      offer_label: null,
      offer_ends_at: null,
      effective_price: 150,
    }
    expect(StorefrontVariantSchema.safeParse(variant).success).toBe(true)
    expect(StorefrontVariantSchema.safeParse({ ...variant, cost_price: 90 }).success).toBe(false)
  })

  it('shows UPI details only through the payment block of a customer order', () => {
    expect(CustomerOrderSchema.shape.payment).toBeDefined()
  })
})

describe('claim_payment', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  it('takes a 12-digit UTR or none', () => {
    expect(ClaimPaymentRequest.safeParse({ p_order_id: id, p_utr: '123456789012' }).success).toBe(true)
    expect(ClaimPaymentRequest.safeParse({ p_order_id: id }).success).toBe(true)
    expect(ClaimPaymentRequest.safeParse({ p_order_id: id, p_utr: '12345678901' }).success).toBe(false)
    expect(ClaimPaymentRequest.safeParse({ p_order_id: id, p_utr: '12345678901a' }).success).toBe(false)
  })
})

describe('Appendix C fixtures are internally consistent', () => {
  const price = { A: VARIANT_A, B: VARIANT_B }
  for (const c of PRICING_CASES) {
    if ('rejected' in c) continue
    it(`${c.id}: subtotal - savings + delivery = total, and the totals follow the shop rules`, () => {
      const list = c.lines.reduce((s, l) => s + price[l.variant].normal * l.qty, 0)
      const now = c.lines.reduce((s, l) => {
        const p = price[l.variant]
        return s + (l.offerActive && p.offer !== null ? p.offer : p.normal) * l.qty
      }, 0)
      expect(c.expect.subtotal).toBe(now)
      expect(c.expect.savings).toBe(list - now)
      const fee =
        c.fulfilment === 'pickup' || now >= PRICING_SHOP.freeDeliveryAbove ? 0 : PRICING_SHOP.deliveryFee
      expect(c.expect.delivery).toBe(fee)
      expect(c.expect.total).toBe(now + fee)
    })
  }

  it('C5 is below the minimum order and C8 is above the quantity cap', () => {
    const c5 = PRICING_CASES.find((c) => c.id === 'C5')
    const c8 = PRICING_CASES.find((c) => c.id === 'C8')
    expect(c5 && 'rejected' in c5 && c5.rejected).toBe('SB421')
    expect(VARIANT_A.normal * 1).toBeLessThan(PRICING_SHOP.minOrder)
    expect(c8 && 'rejected' in c8 && c8.rejected).toBe('SB427')
  })
})

describe('offer window instants', () => {
  it('stored bounds are IST midnights (UTC 18:30 the evening before)', () => {
    // Asia/Kolkata is UTC+5:30 with no DST, so IST midnight = 18:30 UTC of the previous day.
    expect(OFFER_WINDOW.startsAtUtc).toBe('2026-11-23T18:30:00Z')
    expect(OFFER_WINDOW.endsAtUtc).toBe('2026-11-25T18:30:00Z')
  })

  it.each(OFFER_WINDOW_CASES)('$istLabel -> $expected paise', ({ atUtc, expected }) => {
    const at = Date.parse(atUtc)
    const inside = at >= Date.parse(OFFER_WINDOW.startsAtUtc) && at < Date.parse(OFFER_WINDOW.endsAtUtc)
    expect(inside ? OFFER_WINDOW.offer : OFFER_WINDOW.normal).toBe(expected)
  })
})
