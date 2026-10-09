import { describe, expect, it } from 'vitest'
import { BOM } from '../../lib/csv'
import { buildOrdersCsv, csvFileName } from './exportCsv'
import {
  ExportRowSchema,
  MonthAnalyticsSchema,
  PendingRowSchema,
  bucketLabel,
  isQuietMonth,
  percentChange,
  summarizeBuckets,
  type PendingRow,
} from './schemas'

const month = {
  month: '2026-09',
  sales: 1270,
  orders: 2,
  units: 6,
  aov: 635,
  collected: '1440.00',
  collected_online: 1400,
  collected_cash: 40,
  outstanding_total: 930.5,
  outstanding_count: 4,
  by_product: [{ key: 'p1', name: 'Cake', revenue: 1210, units: 3, orders: 2 }],
  by_variant: [
    { key: 'v1', product_name: 'Cake', variant_name: '1 kg', revenue: 960, units: 2, orders: 1 },
  ],
  daily: [{ date: '2026-09-01', sales: 900, orders: 1 }],
}

describe('MonthAnalyticsSchema', () => {
  it('turns every amount into integer paise', () => {
    const a = MonthAnalyticsSchema.parse(month)
    expect(a.sales).toBe(127000)
    expect(a.collected).toBe(144000)
    expect(a.outstanding_total).toBe(93050)
    expect(a.by_product[0]?.revenue).toBe(121000)
    expect(a.daily[0]?.sales).toBe(90000)
  })
  it('rejects a response with a missing field', () => {
    const rest: Record<string, unknown> = { ...month }
    delete rest.sales
    expect(MonthAnalyticsSchema.safeParse(rest).success).toBe(false)
  })
  it('isQuietMonth only when nothing was delivered or collected', () => {
    const a = MonthAnalyticsSchema.parse(month)
    expect(isQuietMonth(a)).toBe(false)
    expect(isQuietMonth({ ...a, orders: 0, collected: 0 })).toBe(true)
    expect(isQuietMonth({ ...a, orders: 0 })).toBe(false)
  })
})

describe('percentChange', () => {
  it('rounds to whole percent', () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(50, 100)).toBe(-50)
    expect(percentChange(100, 300)).toBe(-67)
  })
  it('is n/a (null) when the previous month is zero', () => {
    expect(percentChange(100, 0)).toBeNull()
    expect(percentChange(0, 0)).toBeNull()
  })
})

const pending = (id: string, bucket: string, total: number): PendingRow =>
  PendingRowSchema.parse({
    id,
    order_no: 1,
    bill_no: null,
    customer_name: 'A',
    customer_phone: null,
    total,
    delivered_at: '2026-09-01T10:00:00+00:00',
    age_days: 3,
    bucket,
  })

describe('summarizeBuckets', () => {
  it('keeps every bucket in order, with counts and paise totals', () => {
    const s = summarizeBuckets([
      pending('00000000-0000-4000-8000-000000000001', '0-7', 40),
      pending('00000000-0000-4000-8000-000000000002', '0-7', 10.5),
      pending('00000000-0000-4000-8000-000000000003', '60+', 480),
    ])
    expect(s.map((b) => [b.bucket, b.count, b.total])).toEqual([
      ['0-7', 2, 5050],
      ['8-30', 0, 0],
      ['31-60', 0, 0],
      ['60+', 1, 48000],
    ])
  })
  it('labels buckets', () => {
    expect(bucketLabel('0-7')).toBe('0–7 days')
    expect(bucketLabel('60+')).toBe('60+ days')
  })
})

describe('buildOrdersCsv', () => {
  const row = ExportRowSchema.parse({
    order_no: 12,
    bill_no: 7,
    order_date: '2026-09-28',
    // 30 Sep 23:59:59 IST, still September in India.
    delivered_at: '2026-09-30T18:29:59+00:00',
    customer_name: 'Asha, "AK"',
    customer_phone: '919876543210',
    items: 'Cake 1 kg x 2; Bread Loaf x 1',
    units: 3,
    discount: 60,
    total: '940.50',
    payment_status: 'paid',
    payment_mode: 'online',
    paid_at: '2026-10-01T04:00:00+00:00',
  })

  it('writes header, IST dates, plain decimals and escaped text', () => {
    const lines = buildOrdersCsv([row], 'INV').replace(BOM, '').split('\r\n')
    expect(lines[0]).toBe(
      'Order no,Bill no,Order date,Delivered on,Customer,Phone,Items,Units,Discount (₹),Total (₹),Payment,Mode,Paid on',
    )
    expect(lines[1]).toBe(
      '12,INV-0007,2026-09-28,2026-09-30,"Asha, ""AK""",98765 43210,Cake 1 kg x 2; Bread Loaf x 1,3,60.00,940.50,paid,online,2026-10-01',
    )
    expect(lines[2]).toBe('')
  })
  it('leaves bill, phone, mode and paid date empty when missing', () => {
    const csv = buildOrdersCsv(
      [
        {
          ...row,
          bill_no: null,
          customer_phone: null,
          payment_status: 'pending',
          payment_mode: null,
          paid_at: null,
        },
      ],
      'INV',
    )
    expect(csv.split('\r\n')[1]).toMatch(/^12,,2026-09-28,2026-09-30,.*,,Cake.*,pending,,$/)
  })
  it('starts with a BOM so Excel shows ₹', () => {
    expect(buildOrdersCsv([], 'INV').startsWith(BOM)).toBe(true)
  })
  it('names the file after the month', () => {
    expect(csvFileName('2026-09')).toBe('sellbook-orders-2026-09.csv')
  })
})
