import { describe, expect, it } from 'vitest'
import { SnapshotSchema, versionDiff, type Snapshot } from './history'

const base: Snapshot = SnapshotSchema.parse({
  customer_name: 'Asha',
  customer_phone: '919876543210',
  order_date: '2026-10-09',
  due_date: null,
  notes: null,
  discount: 0,
  total: 500,
  status: 'new',
  payment_status: 'pending',
  payment_mode: null,
  items: [{ product_name: 'Cake', variant_name: '500 g', unit_price: 250, quantity: 2 }],
  // Extra snapshot fields are ignored.
  version_no: 1,
  owner_id: 'x',
})

describe('versionDiff', () => {
  it('is empty when nothing visible changed', () => {
    expect(versionDiff(base, { ...base })).toEqual([])
  })

  it('describes item, discount and total changes', () => {
    const cur: Snapshot = {
      ...base,
      discount: 3000,
      total: 120000,
      items: [
        { product_name: 'Cake', variant_name: '500 g', unit_price: 25000, quantity: 3 },
        { product_name: 'Cake', variant_name: '1 kg', unit_price: 48000, quantity: 1 },
      ],
    }
    const prev: Snapshot = {
      ...base,
      total: 50000,
      items: [{ product_name: 'Cake', variant_name: '500 g', unit_price: 25000, quantity: 2 }],
    }
    expect(versionDiff(prev, cur)).toEqual([
      'Cake 500 g: 2 → 3',
      '+ Cake 1 kg ×1',
      'Discount: ₹0 → ₹30',
      'Total: ₹500 → ₹1,200',
    ])
  })

  it('treats a same item at a new price as removed + added', () => {
    const cur: Snapshot = {
      ...base,
      items: [{ product_name: 'Cake', variant_name: '500 g', unit_price: 999, quantity: 2 }],
    }
    expect(versionDiff(base, cur)).toEqual(['+ Cake 500 g ×2', '− Cake 500 g ×2'])
  })

  it('describes customer, status and payment changes', () => {
    const cur: Snapshot = {
      ...base,
      customer_name: 'Asha K',
      due_date: '2026-10-12',
      status: 'ready',
      payment_status: 'paid',
      payment_mode: 'cash',
    }
    expect(versionDiff(base, cur)).toEqual([
      'Name: Asha → Asha K',
      'Due: none → 12 Oct 2026',
      'Status: New → Ready',
      'Payment: Not paid → Paid · Cash',
    ])
  })
})
