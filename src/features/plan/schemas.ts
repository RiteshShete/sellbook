import { z } from 'zod'
import { formatBytes, pluralize } from '../../lib/format'
import { buildUpiUri, isValidVpa } from '../../lib/upi'

export const TIERS = ['trial', 'base', 'pro'] as const
export type Tier = (typeof TIERS)[number]

export const TIER_LABEL: Record<Tier, string> = { trial: 'Free trial', base: 'Base', pro: 'Pro' }

const limit = z.number().int().nullable()
const scope = z.enum(['total', 'month'])

/** The shop's latest payment request, as my_plan() reports it. */
export const PlanRequestSchema = z.object({
  id: z.guid(),
  tier: z.enum(['base', 'pro']),
  amount_paise: z.number().int(),
  utr: z.string().nullable(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'expired']),
  created_at: z.string(),
  reject_reason: z.string().nullable(),
})
export type PlanRequest = z.infer<typeof PlanRequestSchema>

/** A bank transaction reference (UTR), as the database accepts it. Optional in the form. */
export const UTR_PATTERN = /^[A-Za-z0-9]{6,30}$/

/** my_plan(): the caller's plan. `tier` is null (and status 'locked') when the shop has no subscription row. */
export const PlanSchema = z.object({
  tier: z.enum(TIERS).nullable(),
  status: z.enum(['trial', 'active', 'grace_readonly', 'locked']),
  ends_at: z.string().nullable(),
  /** After this the read-only shop becomes locked. */
  readonly_until: z.string().nullable(),
  can_write: z.boolean(),
  pro_features: z.boolean(),
  /** null = no limit. Orders are counted per IST month, or in total during the trial. */
  limits: z.object({ orders: limit, orders_scope: scope.nullable(), products: limit }),
  usage: z.object({ orders: z.number().int(), products: z.number().int() }),
  /** Bill images: bytes used, the plan's cap (null = none) and how many days an image is kept. */
  storage: z
    .object({ used: z.number().int(), limit: z.number().int().nullable(), keep_days: z.number().int().nullable() })
    .default({ used: 0, limit: null, keep_days: null }),
  /** Shown in the payer's UPI app so the admin can match the payment, e.g. "SB-1A2B3C4D". */
  pay_ref: z.string().nullable().default(null),
  /** Where plan payments go (the platform's UPI ID); null parts = not set up yet. */
  pay_to: z
    .object({
      upi_id: z.string().nullable(),
      payee_name: z.string().nullable(),
      support_email: z.string().nullable(),
    })
    .nullable()
    .default(null),
  request: PlanRequestSchema.nullable().default(null),
})
export type Plan = z.infer<typeof PlanSchema>

/** One row of plan_limits: what each tier costs and allows. price_paise is integer paise. */
export const PlanLimitSchema = z.object({
  tier: z.enum(TIERS),
  price_paise: z.number().int(),
  orders_limit: limit,
  orders_scope: scope,
  products_limit: limit,
  pro_features: z.boolean(),
  period_days: z.number().int(),
  storage_bytes: z.number().int().nullable().default(null),
  bill_keep_days: z.number().int().nullable().default(null),
})
export type PlanLimit = z.infer<typeof PlanLimitSchema>

/** What only Pro (and the trial) can do. Shown on the plan page; the database enforces it. */
export const PRO_FEATURES = [
  'CSV export of orders',
  'Product import from a file',
  'Voice ordering',
  'Order history and rollback',
  'Activity log',
  'Other months and comparison in Money reports',
  'To Prepare list',
  'Pending payments by age',
]

/**
 * The UPI link to pay for a tier, or null while the platform has not set where to pay.
 * Same builder as the bills (lib/upi.ts); the note carries the shop's reference.
 */
export function planPayLink(plan: Plan, limit: PlanLimit): string | null {
  const vpa = (plan.pay_to?.upi_id ?? '').trim()
  const payeeName = (plan.pay_to?.payee_name ?? '').trim()
  if (!isValidVpa(vpa) || !payeeName || !plan.pay_ref || limit.price_paise <= 0) return null
  return buildUpiUri({ vpa, payeeName, amount: limit.price_paise, note: `Sub ${plan.pay_ref}` })
}

export interface PlanNotice {
  tone: 'danger' | 'warning'
  text: string
}

/** Whole days until `endsAt` (0 or less = today or past); null when there is no end date. */
export function daysLeft(endsAt: string | null, now: Date): number | null {
  return endsAt === null ? null : Math.ceil((new Date(endsAt).getTime() - now.getTime()) / 86_400_000)
}

/** One short line for the profile menu: the plan name and how much of its order limit is used. */
export function planChip(plan: Plan): string {
  const name = plan.tier ? TIER_LABEL[plan.tier] : 'No plan'
  const { orders, orders_scope } = plan.limits
  const when = orders_scope === 'month' ? ' this month' : ''
  return orders === null
    ? `${name} · ${pluralize(plan.usage.orders, 'order')}${when}`
    : `${name} · ${plan.usage.orders} of ${orders} orders${when}`
}

/** The one thing worth telling the shop about its plan right now, most urgent first; null = nothing. */
export function planNotice(plan: Plan, now: Date): PlanNotice | null {
  if (plan.status === 'locked') {
    return { tone: 'danger', text: 'Your plan has ended. Renew to use the shop.' }
  }
  if (plan.status === 'grace_readonly') {
    return { tone: 'danger', text: 'Your plan has ended. The shop is read-only until you renew.' }
  }
  const days = daysLeft(plan.ends_at, now)
  if (days !== null && days <= 7) {
    const what = plan.status === 'trial' ? 'Your free trial' : 'Your plan'
    return { tone: 'warning', text: `${what} ends ${days <= 0 ? 'today' : `in ${pluralize(days, 'day')}`}.` }
  }
  const { orders, orders_scope, products } = plan.limits
  if (orders !== null && plan.usage.orders >= orders * 0.8) {
    const when = orders_scope === 'month' ? 'this month' : 'in the trial'
    return { tone: 'warning', text: `${plan.usage.orders} of ${orders} orders used ${when}.` }
  }
  if (products !== null && plan.usage.products >= products * 0.8) {
    return { tone: 'warning', text: `${plan.usage.products} of ${products} products used.` }
  }
  const { used, limit: cap } = plan.storage
  if (cap !== null && used >= cap * 0.8) {
    return { tone: 'warning', text: `Bill storage is ${used >= cap ? 'full' : 'almost full'}: ${formatBytes(used)} of ${formatBytes(cap)}.` }
  }
  return null
}
