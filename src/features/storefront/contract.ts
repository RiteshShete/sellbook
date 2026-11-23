/**
 * Storefront contract (milestone S0, FROZEN until the owner approves a change).
 * One zod schema per request/response of every function in STOREFRONT_PLAN section 7.
 * Rules: money in = integer paise (the API layer converts with fromPaise); money out = dbMoney
 * (numeric -> paise); responses to anon and customers are STRICT, so a leaked field
 * (upi_id, owner_id, cost_price ...) fails parsing instead of being ignored.
 * Nothing here calls the network: S1 writes the SQL, S2+ write the API layer against these.
 */
import { z } from 'zod'
import { SizeUnitSchema, dbAmount } from '../../lib/measure'
import { dbMoney } from '../../lib/zodMoney'

// ---- Shared pieces ----------------------------------------------------------------------------------

export const ERROR_CODES = {
  SB409: 'stale version',
  SB420: 'shop closed, missing or at its plan limit',
  SB421: 'below minimum order',
  SB422: 'item unavailable or not from this shop',
  SB423: 'requested date before the lead time',
  SB424: 'too many open orders',
  SB425: 'invalid state change',
  SB426: 'customer blocked',
  SB427: 'invalid input',
  SB428: 'invite missing, used or expired',
  SB429: 'daily order cap reached',
} as const
export type ErrorCode = keyof typeof ERROR_CODES

export const LIMITS = {
  maxLines: 30,
  maxQty: 50,
  maxTotalPaise: 5_000_000, // Rs 50,000
  openOrdersPerShop: 5,
  ordersPer24h: 20,
  maxAddresses: 5,
  maxImages: 5,
  maxAdvanceDays: 30,
  maxClaims: 3,
} as const

const Uuid = z.guid()
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const Timestamp = z.string().min(10)
export const SlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/)
/** Digits with country code, e.g. 919876543210 (lib/phone.ts normalizePhone). */
const Phone = z.string().regex(/^\d{10,15}$/)
const Paise = z.number().int().nonnegative()
const Pincode = z.string().regex(/^[1-9][0-9]{5}$/)
const Utr = z.string().regex(/^\d{12}$/)

export const FULFILMENTS = ['delivery', 'pickup'] as const
export const DELIVERY_MODES = ['delivery', 'pickup', 'both'] as const
export const PAYMENT_METHODS = ['upi', 'cod'] as const
export const CONFIRMATION = ['not_needed', 'pending', 'confirmed', 'declined'] as const
export const CLAIM_STATUS = ['none', 'claimed', 'verified', 'rejected'] as const
export const VEG_TYPES = ['veg', 'non_veg', 'egg'] as const
export const NUTRITION_KEYS = [
  'energy_kcal',
  'protein_g',
  'carbs_g',
  'sugars_g',
  'fat_g',
  'fibre_g',
  'sodium_mg',
] as const

export const AddressSchema = z.strictObject({
  name: z.string().min(1).max(100),
  phone: Phone,
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).nullish(),
  area: z.string().max(100).nullish(),
  city: z.string().min(1).max(100),
  pincode: Pincode,
  landmark: z.string().max(100).nullish(),
})

// ---- Public (anon) ------------------------------------------------------------------------------------

export const StorefrontShopSchema = z.strictObject({
  slug: SlugSchema,
  name: z.string(),
  tagline: z.string().nullable(),
  banner_text: z.string().nullable(),
  logo_path: z.string().nullable(),
  whatsapp: Phone.nullable(),
  city: z.string().nullable(),
  fssai_no: z.string().nullable(),
  accepts_orders: z.boolean(),
  closed_message: z.string().nullable(),
  delivery_mode: z.enum(DELIVERY_MODES),
  delivery_fee: dbMoney,
  free_delivery_above: dbMoney.nullable(),
  min_order: dbMoney,
  lead_time_hours: z.number().int(),
  delivery_note: z.string().nullable(),
  /** True only when a valid UPI ID exists; the ID itself is never public. */
  pay_upi: z.boolean(),
  pay_cod: z.boolean(),
  pickup_address: z.string().nullable(),
  /** IST date computed on the server so a wrong phone clock cannot change it. */
  earliest_date: DateOnly,
})
/** null = unpublished, deleted or unknown slug (all look the same). */
export const StorefrontShopResponse = StorefrontShopSchema.nullable()

export const StorefrontVariantSchema = z.strictObject({
  id: Uuid,
  name: z.string(),
  size_amount: dbAmount.nullable(),
  size_unit: SizeUnitSchema.nullable(),
  /** Normal price (MRP). */
  price: dbMoney,
  offer_price: dbMoney.nullable(),
  offer_label: z.string().nullable(),
  offer_ends_at: Timestamp.nullable(),
  /** effective_price(variant, now()): the only price the cart may show. */
  effective_price: dbMoney,
})

export const StorefrontProductSchema = z.strictObject({
  id: Uuid,
  category_id: Uuid.nullable(),
  name: z.string(),
  description: z.string().nullable(),
  ingredients: z.string().nullable(),
  nutrition: z.partialRecord(z.enum(NUTRITION_KEYS), z.number()).nullable(),
  allergens: z.array(z.string()),
  veg_type: z.enum(VEG_TYPES).nullable(),
  shelf_life: z.string().nullable(),
  is_available: z.boolean(),
  image_paths: z.array(z.string()).max(LIMITS.maxImages),
  variants: z.array(StorefrontVariantSchema),
})

export const StorefrontCatalogSchema = z.strictObject({
  categories: z.array(z.strictObject({ id: Uuid, name: z.string(), sort_order: z.number().int() })),
  products: z.array(StorefrontProductSchema),
})

export const SlugAvailableResponse = z.boolean()

// ---- Customer ------------------------------------------------------------------------------------------

export const MyContextSchema = z.strictObject({
  is_owner: z.boolean(),
  shop_slug: SlugSchema.nullable(),
  has_customer_profile: z.boolean(),
})

export const RegisterCustomerRequest = z.strictObject({
  p_name: z.string().min(1).max(100),
  p_phone: Phone,
})

export const AddressRowSchema = AddressSchema.extend({
  id: Uuid,
  label: z.string().nullable(),
  is_default: z.boolean(),
})
export const UpsertAddressRequest = AddressSchema.extend({
  id: Uuid.optional(),
  label: z.string().max(40).nullish(),
  is_default: z.boolean().optional(),
})

/** Everything the browser may send. Prices, totals and owner ids are deliberately absent. */
export const PlaceOrderRequest = z
  .strictObject({
    slug: SlugSchema,
    items: z
      .array(z.strictObject({ variant_id: Uuid, qty: z.number().int().min(1).max(LIMITS.maxQty) }))
      .min(1)
      .max(LIMITS.maxLines),
    fulfilment: z.enum(FULFILMENTS),
    address: AddressSchema.optional(),
    address_id: Uuid.optional(),
    requested_for: DateOnly,
    notes: z.string().max(300).nullish(),
    payment_method: z.enum(PAYMENT_METHODS),
    idempotency_key: Uuid,
  })
  .refine((v) => v.fulfilment === 'pickup' || v.address || v.address_id, {
    message: 'delivery needs an address',
  })

export const OrderBreakdownSchema = z.strictObject({
  subtotal: dbMoney,
  offer_savings: dbMoney,
  delivery_fee: dbMoney,
  total: dbMoney,
})

/** UPI details are present ONLY while the order is an unpaid UPI order. */
export const PaymentInfoSchema = z.strictObject({
  method: z.enum(PAYMENT_METHODS),
  upi_id: z.string().nullable(),
  payee_name: z.string().nullable(),
})

export const PlaceOrderResponse = z.strictObject({
  order_id: Uuid,
  order_no: z.number().int(),
  breakdown: OrderBreakdownSchema,
  payment: PaymentInfoSchema,
})

export const CustomerOrderLine = z.strictObject({
  product_name: z.string(),
  variant_name: z.string(),
  qty: z.number().int(),
  unit_price: dbMoney,
  list_price: dbMoney.nullable(),
  offer_label: z.string().nullable(),
})

export const CustomerOrderSummary = z.strictObject({
  id: Uuid,
  order_no: z.number().int(),
  created_at: Timestamp,
  status: z.enum(['new', 'ready', 'delivered', 'cancelled']),
  confirmation_status: z.enum(CONFIRMATION),
  payment_status: z.enum(['pending', 'paid']),
  payment_claim_status: z.enum(CLAIM_STATUS),
  total: dbMoney,
})
export const CustomerOrdersListRequest = z.strictObject({
  p_slug: SlugSchema,
  p_limit: z.number().int().min(1).max(50).default(20),
  p_before: Timestamp.nullish(),
})
export const CustomerOrdersListResponse = z.array(CustomerOrderSummary)

export const CustomerOrderSchema = CustomerOrderSummary.extend({
  items: z.array(CustomerOrderLine),
  breakdown: OrderBreakdownSchema,
  fulfilment: z.enum(FULFILMENTS),
  address: AddressSchema.nullable(),
  requested_for: DateOnly.nullable(),
  notes: z.string().nullable(),
  decline_reason: z.string().nullable(),
  payment_reject_reason: z.string().nullable(),
  claim_count: z.number().int(),
  payment: PaymentInfoSchema,
  shop: z.strictObject({ name: z.string(), slug: SlugSchema, whatsapp: Phone.nullable() }),
})

export const ClaimPaymentRequest = z.strictObject({
  p_order_id: Uuid,
  p_utr: Utr.nullish(),
})

// ---- Owner ------------------------------------------------------------------------------------------------

export const CreateShopRequest = z.strictObject({
  p_invite: z.string().min(6).max(20),
  p_slug: SlugSchema,
  p_name: z.string().min(1).max(100),
})

/** Allow-listed keys only; money in paise (API layer sends rupees). */
export const UpdateShopRequest = z.strictObject({
  tagline: z.string().max(120).nullish(),
  banner_text: z.string().max(200).nullish(),
  city: z.string().max(80).nullish(),
  fssai_no: z.string().max(20).nullish(),
  delivery_note: z.string().max(200).nullish(),
  closed_message: z.string().max(200).nullish(),
  whatsapp: Phone.nullish(),
  logo_path: z.string().nullish(),
  accepts_orders: z.boolean().optional(),
  delivery_mode: z.enum(DELIVERY_MODES).optional(),
  delivery_fee: Paise.optional(),
  min_order: Paise.optional(),
  free_delivery_above: Paise.nullish(),
  lead_time_hours: z.number().int().min(0).max(720).optional(),
  pay_upi: z.boolean().optional(),
  pay_cod: z.boolean().optional(),
})

export const PublishChecklistItems = [
  'shop_name',
  'slug',
  'available_variant',
  'whatsapp',
  'recovery_email',
  'payment_method',
  'fulfilment',
  'plan_active',
] as const
export const SetShopPublishedResponse = z.strictObject({
  published: z.boolean(),
  missing: z.array(z.enum(PublishChecklistItems)),
})

export const BulkOfferRequest = z.strictObject({
  variant_ids: z.array(Uuid).min(1),
  percent_off: z.number().min(1).max(90).optional(),
  amount_off: Paise.optional(),
  label: z.string().max(40).nullish(),
  /** Inclusive IST dates; the server stores the exclusive next-day IST midnight. */
  starts_on: DateOnly,
  ends_on: DateOnly,
})
export const EndOffersRequest = z.strictObject({ p_variant_ids: z.array(Uuid).nullable() })

const Version = z.number().int().min(1)
export const ConfirmOrderRequest = z.strictObject({
  p_id: Uuid,
  p_note: z.string().max(300).nullish(),
  v: Version,
})
export const DECLINE_REASONS = ['out_of_stock', 'too_far', 'closed', 'other'] as const
export const DeclineOrderRequest = z.strictObject({
  p_id: Uuid,
  p_reason: z.string().min(1).max(300),
  v: Version,
})
export const DeclineOrderResponse = z.strictObject({ refund_needed: z.boolean() })
export const VerifyPaymentRequest = z.strictObject({ p_id: Uuid, v: Version })
export const VerifyPaymentResponse = z.strictObject({
  duplicate_utr_order_no: z.number().int().nullable(),
})
export const RejectPaymentRequest = z.strictObject({
  p_id: Uuid,
  p_reason: z.string().min(1).max(300),
  v: Version,
})
export const SetCustomerBlockRequest = z.strictObject({
  p_customer: Uuid,
  p_blocked: z.boolean(),
})
export const ShopCustomerSchema = z.strictObject({
  customer_user_id: Uuid,
  customer_name: z.string(),
  customer_phone: Phone,
  first_order_at: Timestamp,
  last_order_at: Timestamp,
  order_count: z.number().int(),
  is_blocked: z.boolean(),
  owner_note: z.string().nullable(),
})
export const MyCustomersResponse = z.array(ShopCustomerSchema)
