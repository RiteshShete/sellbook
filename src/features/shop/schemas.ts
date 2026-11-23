import { z } from 'zod'
import type { ShopRules } from '../../lib/pricing'
import { SizeUnitSchema, dbAmount } from '../../lib/measure'
import { dbMoney, dbMoneyNullable } from '../../lib/zodMoney'
import { DELIVERY_MODES, PublishChecklistItems } from '../storefront/contract'

/** The owner's own `shops` row (row-level security shows only theirs). */
export const ShopSchema = z.object({
  slug: z.string(),
  tagline: z.string().nullable(),
  banner_text: z.string().nullable(),
  city: z.string().nullable(),
  fssai_no: z.string().nullable(),
  delivery_note: z.string().nullable(),
  closed_message: z.string().nullable(),
  whatsapp: z.string().nullable(),
  logo_path: z.string().nullable(),
  is_published: z.boolean(),
  ever_published: z.boolean(),
  accepts_orders: z.boolean(),
  delivery_mode: z.enum(DELIVERY_MODES),
  delivery_fee: dbMoney,
  min_order: dbMoney,
  free_delivery_above: dbMoneyNullable,
  lead_time_hours: z.number().int(),
  pay_upi: z.boolean(),
  pay_cod: z.boolean(),
})
export type Shop = z.infer<typeof ShopSchema>

export const SHOP_COLUMNS =
  'slug, tagline, banner_text, city, fssai_no, delivery_note, closed_message, whatsapp, logo_path, is_published, ever_published, accepts_orders, delivery_mode, delivery_fee, min_order, free_delivery_above, lead_time_hours, pay_upi, pay_cod'

export const shopRules = (s: Shop): ShopRules => ({
  deliveryFee: s.delivery_fee,
  freeDeliveryAbove: s.free_delivery_above,
  minOrder: s.min_order,
})

/** A variant with its offer, and the product it belongs to (for the Pricing and Offers page). */
export const OfferVariantSchema = z.object({
  id: z.string(),
  name: z.string(),
  size_amount: dbAmount.nullable(),
  size_unit: SizeUnitSchema.nullable(),
  price: dbMoney,
  offer_price: dbMoneyNullable,
  offer_label: z.string().nullable(),
  offer_starts_at: z.string().nullable(),
  offer_ends_at: z.string().nullable(),
  products: z.object({ id: z.string(), name: z.string(), is_active: z.boolean(), sort_order: z.number() }),
})
export type OfferVariant = z.infer<typeof OfferVariantSchema>

export const PublishResultSchema = z.object({
  published: z.boolean(),
  missing: z.array(z.enum(PublishChecklistItems)),
})
export type PublishResult = z.infer<typeof PublishResultSchema>

/** What the owner reads for each thing still missing before the shop can be published. */
export const MISSING_TEXT: Record<(typeof PublishChecklistItems)[number], string> = {
  shop_name: 'Add your shop name in Settings.',
  slug: 'Choose the shop web address.',
  available_variant: 'Add at least one product that is active, available and has a price.',
  whatsapp: 'Add your WhatsApp number below.',
  recovery_email: 'Confirm a recovery email in Account & security.',
  payment_method: 'Turn on pay on delivery, or add your UPI ID and payee name in Settings.',
  fulfilment: 'Choose delivery, pickup or both.',
  plan_active: 'Your plan has ended: renew it in Your plan.',
}

/** The product's online details and pictures. */
export const OnlineDetailsSchema = z.object({
  description: z.string().nullable(),
  ingredients: z.string().nullable(),
  allergens: z.array(z.string()),
  veg_type: z.enum(['veg', 'non_veg', 'egg']).nullable(),
  shelf_life: z.string().nullable(),
  is_available: z.boolean(),
  image_paths: z.array(z.string()),
})
export type OnlineDetails = z.infer<typeof OnlineDetailsSchema>

/** "nuts, milk , " -> ["nuts", "milk"]; at most 20 as the database allows. */
export function parseAllergens(text: string): string[] {
  return text
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 20)
}
