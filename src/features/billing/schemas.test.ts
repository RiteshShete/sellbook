import { describe, expect, it } from 'vitest'
import {
  BillSchema,
  BillSourceSchema,
  billFileName,
  billShareText,
  formatBillNo,
  isOutdated,
  type Bill,
} from './schemas'

const bill = (revision: number, items_hash: string): Bill => ({
  id: '00000000-0000-4000-8000-00000000000' + String(revision),
  order_id: '00000000-0000-4000-8000-000000000000',
  bill_no: 7,
  revision,
  image_path: `u/2026/bill-${revision}.png`,
  total_at_generation: 50000,
  items_hash,
  generated_at: '2026-10-10T05:00:00+00:00',
})

describe('formatBillNo', () => {
  it('pads to 4 digits with the prefix', () => {
    expect(formatBillNo('INV', 7)).toBe('INV-0007')
    expect(formatBillNo('INV', 12345)).toBe('INV-12345')
    expect(formatBillNo('', 7)).toBe('0007')
    expect(billFileName('AB', 1)).toBe('AB-0001.png')
  })
})

describe('isOutdated (B7)', () => {
  it('is false with no bill yet', () => {
    expect(isOutdated({ bills: [], currentHash: 'x' })).toBe(false)
  })
  it('compares the newest revision only', () => {
    expect(isOutdated({ bills: [bill(2, 'new'), bill(1, 'old')], currentHash: 'new' })).toBe(false)
    expect(isOutdated({ bills: [bill(2, 'old')], currentHash: 'new' })).toBe(true)
  })
})

describe('schemas', () => {
  it('parses a bill row with numeric money into paise', () => {
    const row = { ...bill(1, 'h'), total_at_generation: '500.00', owner_id: 'ignored' }
    expect(BillSchema.parse(row).total_at_generation).toBe(50000)
  })

  it('parses the reserve snapshot and sorts items by position', () => {
    const item = (position: number) => ({
      id: `00000000-0000-4000-8000-00000000001${position}`,
      variant_id: null,
      product_name: 'Cake',
      variant_name: `${position}`,
      unit_price: 250,
      quantity: 1,
      line_total: 250,
      position,
    })
    const src = BillSourceSchema.parse({
      id: '00000000-0000-4000-8000-000000000000',
      order_no: 3,
      customer_name: 'Asha',
      customer_phone: null,
      order_date: '2026-10-10',
      due_date: null,
      notes: null,
      status: 'new',
      payment_status: 'pending',
      payment_mode: null,
      discount: 0,
      total: 500,
      bill_no: 7,
      version_no: 1,
      created_at: '2026-10-10T05:00:00+00:00',
      ready_at: null,
      delivered_at: null,
      paid_at: null,
      cancelled_at: null,
      cancelled_from: null,
      items: [item(1), item(0)],
      content_hash: 'abc',
    })
    expect(src.items.map((i) => i.position)).toEqual([0, 1])
    expect(src.total).toBe(50000)
  })
})

describe('billShareText', () => {
  it('adds a UPI link for the bill amount when a UPI id is set', () => {
    const t = billShareText(
      { customer_name: 'Ravi' },
      { shop_name: 'Asha Cakes', upi_id: 'shop@okicici' },
      'INV-0007',
      50000,
    )
    expect(t).toContain('Amount: ₹500')
    expect(t).toContain(
      'upi://pay?pa=shop%40okicici&pn=Asha%20Cakes&am=500.00&cu=INR&tn=Bill%20INV-0007',
    )
  })
  it('has no link without a UPI id', () => {
    expect(
      billShareText({ customer_name: 'Ravi' }, { shop_name: '', upi_id: null }, '0001', 100),
    ).not.toContain('upi://')
  })
})
