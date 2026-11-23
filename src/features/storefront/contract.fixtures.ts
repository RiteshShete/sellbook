/**
 * Frozen examples for the storefront contract (S0). Appendix C of the plan, in integer paise.
 * S1 runs the SAME cases against the SQL functions; S3 runs them against lib/pricing.ts.
 */

/** Shop used by the pricing cases: fee Rs 40, free from Rs 500 (inclusive), minimum Rs 200. */
export const PRICING_SHOP = { deliveryFee: 4000, freeDeliveryAbove: 50000, minOrder: 20000 } as const
export const VARIANT_A = { normal: 15000, offer: 12000 } as const
export const VARIANT_B = { normal: 10000, offer: null } as const

export type PricingCase =
  | {
      id: string
      lines: { variant: 'A' | 'B'; qty: number; offerActive: boolean }[]
      fulfilment: 'delivery' | 'pickup'
      expect: { subtotal: number; savings: number; delivery: number; total: number }
    }
  | {
      id: string
      lines: { variant: 'A' | 'B'; qty: number; offerActive: boolean }[]
      fulfilment: 'delivery' | 'pickup'
      rejected: 'SB421' | 'SB427'
    }

export const PRICING_CASES: PricingCase[] = [
  { id: 'C1', lines: [{ variant: 'A', qty: 2, offerActive: false }], fulfilment: 'delivery', expect: { subtotal: 30000, savings: 0, delivery: 4000, total: 34000 } },
  { id: 'C2', lines: [{ variant: 'A', qty: 2, offerActive: true }], fulfilment: 'delivery', expect: { subtotal: 24000, savings: 6000, delivery: 4000, total: 28000 } },
  { id: 'C3', lines: [{ variant: 'A', qty: 4, offerActive: false }], fulfilment: 'delivery', expect: { subtotal: 60000, savings: 0, delivery: 0, total: 60000 } },
  { id: 'C4', lines: [{ variant: 'A', qty: 4, offerActive: true }], fulfilment: 'delivery', expect: { subtotal: 48000, savings: 12000, delivery: 4000, total: 52000 } },
  { id: 'C5', lines: [{ variant: 'A', qty: 1, offerActive: false }], fulfilment: 'delivery', rejected: 'SB421' },
  { id: 'C6', lines: [{ variant: 'A', qty: 2, offerActive: false }], fulfilment: 'pickup', expect: { subtotal: 30000, savings: 0, delivery: 0, total: 30000 } },
  { id: 'C7', lines: [{ variant: 'B', qty: 5, offerActive: false }], fulfilment: 'delivery', expect: { subtotal: 50000, savings: 0, delivery: 0, total: 50000 } },
  { id: 'C8', lines: [{ variant: 'B', qty: 51, offerActive: false }], fulfilment: 'delivery', rejected: 'SB427' },
]
// C9 (total above Rs 50,000) and C10 (delivery on a pickup-only shop) need a shop/cart setup of their
// own; S1 adds them to the pgTAP file.

/** Offer window: owner enters inclusive IST dates 24-25 Nov 2026; stored [24 Nov 00:00 IST, 26 Nov 00:00 IST). */
export const OFFER_WINDOW = {
  startsAtUtc: '2026-11-23T18:30:00Z', // 24 Nov 00:00 IST
  endsAtUtc: '2026-11-25T18:30:00Z', // 26 Nov 00:00 IST (exclusive)
  normal: 15000,
  offer: 12000,
} as const

export const OFFER_WINDOW_CASES = [
  { istLabel: '23 Nov 23:59:59', atUtc: '2026-11-23T18:29:59Z', expected: 15000 },
  { istLabel: '24 Nov 00:00:00', atUtc: '2026-11-23T18:30:00Z', expected: 12000 },
  { istLabel: '25 Nov 23:59:59', atUtc: '2026-11-25T18:29:59Z', expected: 12000 },
  { istLabel: '26 Nov 00:00:00', atUtc: '2026-11-25T18:30:00Z', expected: 15000 },
] as const

// ---- Valid payload examples (one per request that carries user input) -------------------------------------

export const EXAMPLE_PLACE_ORDER = {
  slug: 'ritesh-foods',
  items: [{ variant_id: '11111111-1111-4111-8111-111111111111', qty: 2 }],
  fulfilment: 'delivery',
  address: {
    name: 'Asha Patil',
    phone: '919876543210',
    line1: '12 Market Road',
    city: 'Pune',
    pincode: '411001',
  },
  requested_for: '2026-11-25',
  payment_method: 'upi',
  idempotency_key: '22222222-2222-4222-8222-222222222222',
} as const

export const EXAMPLE_SHOP = {
  slug: 'ritesh-foods',
  name: 'Ritesh Foods',
  tagline: 'Fresh snacks',
  banner_text: null,
  logo_path: null,
  whatsapp: '919876543210',
  city: 'Pune',
  fssai_no: null,
  accepts_orders: true,
  closed_message: null,
  delivery_mode: 'both',
  delivery_fee: '40.00',
  free_delivery_above: '500.00',
  min_order: '200.00',
  lead_time_hours: 24,
  delivery_note: 'Within 5 km',
  pay_upi: true,
  pay_cod: true,
  pickup_address: '12 Market Road, Pune',
  earliest_date: '2026-11-25',
} as const
