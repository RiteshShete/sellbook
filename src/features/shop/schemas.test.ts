import { describe, expect, it } from 'vitest'
import { PublishChecklistItems } from '../storefront/contract'
import { MISSING_TEXT, OfferVariantSchema, ShopSchema, parseAllergens, shopRules } from './schemas'

const shopRow = {
  slug: 'a-foods', tagline: null, banner_text: null, city: 'Pune', fssai_no: null, delivery_note: null,
  closed_message: null, whatsapp: '919876543210', logo_path: null, is_published: false, ever_published: false,
  accepts_orders: true, delivery_mode: 'both', delivery_fee: '40.00', min_order: 200, free_delivery_above: '500.00',
  lead_time_hours: 24, pay_upi: true, pay_cod: true,
}

describe('ShopSchema', () => {
  it('turns the database rupees into integer paise', () => {
    const shop = ShopSchema.parse(shopRow)
    expect([shop.delivery_fee, shop.min_order, shop.free_delivery_above]).toEqual([4000, 20000, 50000])
    expect(shopRules(shop)).toEqual({ deliveryFee: 4000, freeDeliveryAbove: 50000, minOrder: 20000 })
  })

  it('keeps "no free delivery threshold" as null', () => {
    expect(shopRules(ShopSchema.parse({ ...shopRow, free_delivery_above: null })).freeDeliveryAbove).toBeNull()
  })

  it('refuses an unknown delivery mode', () => {
    expect(ShopSchema.safeParse({ ...shopRow, delivery_mode: 'drone' }).success).toBe(false)
  })
})

describe('OfferVariantSchema', () => {
  it('reads a variant with its product and an offer in paise', () => {
    const v = OfferVariantSchema.parse({
      id: 'v1', name: 'Retail', size_amount: '500', size_unit: 'g', price: '150.00', offer_price: '120.00', offer_label: 'Diwali',
      offer_starts_at: '2026-11-23T18:30:00+00:00', offer_ends_at: '2026-11-25T18:30:00+00:00',
      products: { id: 'p1', name: 'Chakli', is_active: true, sort_order: 0 },
    })
    expect([v.price, v.offer_price]).toEqual([15000, 12000])
  })
})

describe('publish checklist wording', () => {
  it('has a sentence for every item the server can report', () => {
    for (const item of PublishChecklistItems) expect(MISSING_TEXT[item]).toBeTruthy()
  })
})

describe('parseAllergens', () => {
  it('splits on commas, trims and drops empties', () => {
    expect(parseAllergens(' nuts, milk , ,gluten ')).toEqual(['nuts', 'milk', 'gluten'])
    expect(parseAllergens('')).toEqual([])
  })
  it('keeps at most 20, as the database allows', () => {
    expect(parseAllergens(Array.from({ length: 30 }, (_, i) => `a${i}`).join(',')).length).toBe(20)
  })
})
