import { StorefrontCatalogSchema, StorefrontShopSchema } from './contract'
import { EXAMPLE_SHOP } from './contract.fixtures'
import type { StoreCatalog, StoreShop } from './types'

export const V_CHAKLI = '11111111-1111-4111-8111-111111111111'
export const V_LADOO = '22222222-2222-4222-8222-222222222222'
export const V_SOLD_OUT = '33333333-3333-4333-8333-333333333333'
export const CAT_SNACKS = '44444444-4444-4444-8444-444444444444'

/** Delivery Rs 40, free from Rs 500, minimum Rs 200, both ways, UPI and COD (the plan's Appendix C shop). */
export const shop = (over: Record<string, unknown> = {}): StoreShop => StorefrontShopSchema.parse({ ...EXAMPLE_SHOP, ...over })

const variant = (id: string, name: string, price: number, effective = price) => ({
  id, name, size_amount: null, size_unit: null, price, effective_price: effective,
  offer_price: effective < price ? effective : null, offer_label: effective < price ? 'Diwali offer' : null,
  offer_ends_at: effective < price ? '2026-11-25T18:30:00Z' : null,
})

const product = (id: string, name: string, v: ReturnType<typeof variant>[], extra: Record<string, unknown> = {}) => ({
  id, category_id: null, name, description: null, ingredients: null, nutrition: null, allergens: [], veg_type: 'veg',
  shelf_life: null, is_available: true, image_paths: [], variants: v, ...extra,
})

/** Chakli (150, offer 120), Ladoo (100, in the Snacks category) and a sold-out product. */
export const catalog = (): StoreCatalog =>
  StorefrontCatalogSchema.parse({
    categories: [{ id: CAT_SNACKS, name: 'Snacks', sort_order: 0 }],
    products: [
      product('66666666-6666-4666-8666-666666666661', 'Chakli', [variant(V_CHAKLI, '500 g', 150, 120)]),
      product('66666666-6666-4666-8666-666666666662', 'Ladoo', [variant(V_LADOO, 'Box', 100)], { category_id: CAT_SNACKS }),
      product('66666666-6666-4666-8666-666666666663', 'Shankarpali', [variant(V_SOLD_OUT, 'Pack', 80)], { is_available: false }),
    ],
  })
