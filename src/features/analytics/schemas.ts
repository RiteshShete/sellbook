import { z } from 'zod'
import { addMoney, type Paise } from '../../lib/money'
import { measureTotalsShape } from '../../lib/measure'
import { dbMoney } from '../../lib/zodMoney'

const count = z.number().int()

/** analytics_month(p_month). Money is integer paise after parsing. Definitions: PLAN §5.1. */
export const MonthAnalyticsSchema = z.object({
  month: z.string(),
  sales: dbMoney,
  orders: count,
  units: count,
  aov: dbMoney,
  collected: dbMoney,
  collected_online: dbMoney,
  collected_cash: dbMoney,
  outstanding_total: dbMoney,
  outstanding_count: count,
  by_product: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      revenue: dbMoney,
      units: count,
      orders: count,
      ...measureTotalsShape,
    }),
  ),
  by_variant: z.array(
    z.object({
      key: z.string(),
      product_name: z.string(),
      variant_name: z.string(),
      revenue: dbMoney,
      units: count,
      orders: count,
      ...measureTotalsShape,
    }),
  ),
  daily: z.array(z.object({ date: z.string(), sales: dbMoney, orders: count })),
})
export type MonthAnalytics = z.infer<typeof MonthAnalyticsSchema>

export const AGE_BUCKETS = ['0-7', '8-30', '31-60', '60+'] as const
export type AgeBucket = (typeof AGE_BUCKETS)[number]

/** One row of pending_payments(): delivered, unpaid, oldest first. */
export const PendingRowSchema = z.object({
  id: z.guid(),
  order_no: count,
  bill_no: count.nullable(),
  customer_name: z.string(),
  customer_phone: z.string().nullable(),
  total: dbMoney,
  delivered_at: z.string(),
  age_days: count,
  bucket: z.enum(AGE_BUCKETS),
})
export type PendingRow = z.infer<typeof PendingRowSchema>

/** One row of export_orders_csv_rows(p_month): an order delivered in the month. */
export const ExportRowSchema = z.object({
  order_no: count,
  bill_no: count.nullable(),
  order_date: z.string(),
  delivered_at: z.string(),
  customer_name: z.string(),
  customer_phone: z.string().nullable(),
  items: z.string(),
  units: count,
  discount: dbMoney,
  total: dbMoney,
  payment_status: z.enum(['pending', 'paid']),
  payment_mode: z.enum(['online', 'cash']).nullable(),
  paid_at: z.string().nullable(),
})
export type ExportRow = z.infer<typeof ExportRowSchema>

/** Whole-percent change vs the previous month; null ("n/a") when there is nothing to compare. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

/** True when the month has nothing to chart (no sales and nothing collected). */
export function isQuietMonth(a: MonthAnalytics): boolean {
  return a.orders === 0 && a.collected === 0
}

export interface BucketSummary {
  bucket: AgeBucket
  count: number
  total: Paise
}

/** Count and amount per ageing bucket, every bucket present (in order), even when empty. */
export function summarizeBuckets(rows: PendingRow[]): BucketSummary[] {
  return AGE_BUCKETS.map((bucket) => {
    const inBucket = rows.filter((r) => r.bucket === bucket)
    return { bucket, count: inBucket.length, total: addMoney(...inBucket.map((r) => r.total)) }
  })
}

/** "0-7" -> "0–7 days", "60+" -> "60+ days" */
export function bucketLabel(bucket: AgeBucket): string {
  return `${bucket.replace('-', '–')} days`
}
