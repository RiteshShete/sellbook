import { describe, expect, it } from 'vitest'
import {
  OrderListRowSchema,
  OrderWithItemsSchema,
  draftFromOrder,
  draftTotals,
  validateOrderDraft,
  type LineDraft,
  type OrderDraft,
} from './schemas'

const O = '11111111-1111-1111-1111-111111111111'
const I1 = '22222222-2222-2222-2222-222222222222'
const I2 = '33333333-3333-3333-3333-333333333333'
const V = '44444444-4444-4444-4444-444444444444'

const orderRow = {
  id: O,
  order_no: 7,
  customer_name: 'Asha',
  customer_phone: '919876543210',
  order_date: '2026-10-09',
  due_date: null,
  notes: null,
  status: 'new',
  payment_status: 'pending',
  payment_mode: null,
  discount: 30.5,
  total: '950.00',
  bill_no: null,
  version_no: 1,
  created_at: '2026-10-09T05:00:00+00:00',
  ready_at: null,
  delivered_at: null,
  paid_at: null,
  cancelled_at: null,
}

const item = (id: string, position: number, price: number, qty: number) => ({
  id,
  variant_id: V,
  product_name: 'Cake',
  variant_name: `v${position}`,
  unit_price: price,
  quantity: qty,
  line_total: price * qty,
  position,
})

describe('order row schemas', () => {
  it('parses money to paise and sorts items by position', () => {
    const o = OrderWithItemsSchema.parse({
      ...orderRow,
      order_items: [item(I2, 1, 480.5, 1), item(I1, 0, 250, 2)],
    })
    expect(o.total).toBe(95000)
    expect(o.discount).toBe(3050)
    expect(o.items.map((i) => i.id)).toEqual([I1, I2])
    expect(o.items[1]?.line_total).toBe(48050)
  })

  it('counts units on list rows', () => {
    const r = OrderListRowSchema.parse({
      ...orderRow,
      order_items: [{ quantity: 2 }, { quantity: 3 }],
    })
    expect(r.units).toBe(5)
  })

  it('rejects an unknown status', () => {
    expect(() =>
      OrderWithItemsSchema.parse({ ...orderRow, status: 'lost', order_items: [] }),
    ).toThrow()
  })
})

describe('draftFromOrder', () => {
  it('shows the phone without country code and keeps item ids', () => {
    const d = draftFromOrder(
      OrderWithItemsSchema.parse({ ...orderRow, order_items: [item(I1, 0, 250, 2)] }),
    )
    expect(d.customer_phone).toBe('9876543210')
    expect(d.discount).toBe('30.5')
    expect(d.lines[0]).toMatchObject({ key: I1, id: I1, unit_price: 25000, quantity: 2 })
  })
})

const line = (over: Partial<LineDraft> = {}): LineDraft => ({
  key: 'k1',
  variant_id: V,
  product_name: 'Cake',
  variant_name: '500 g',
  unit_price: 25000,
  quantity: 2,
  ...over,
})

const draft = (over: Partial<OrderDraft> = {}): OrderDraft => ({
  customer_name: ' Asha ',
  customer_phone: '098765 43210',
  order_date: '2026-10-09',
  due_date: '',
  notes: '  ',
  discount: '',
  lines: [line(), line({ key: 'k2', id: I1, unit_price: 48050, quantity: 1 })],
  ...over,
})

describe('draftTotals', () => {
  it('matches the database arithmetic in paise, never below zero', () => {
    expect(draftTotals(draft().lines, '30.50')).toEqual({
      subtotal: 98050,
      discount: 3050,
      total: 95000,
    })
    expect(draftTotals([], '10').total).toBe(0)
  })
})

describe('validateOrderDraft', () => {
  it('builds the RPC payload', () => {
    expect(validateOrderDraft(draft({ discount: '₹30.50' }))).toEqual({
      ok: true,
      payload: {
        customer_name: 'Asha',
        customer_phone: '919876543210',
        order_date: '2026-10-09',
        due_date: null,
        notes: null,
        discount: '30.50',
        items: [
          { variant_id: V, quantity: 2 },
          { id: I1, variant_id: V, quantity: 1 },
        ],
      },
    })
  })

  it('allows no phone and no items (draft order)', () => {
    const r = validateOrderDraft(draft({ customer_phone: '', lines: [] }))
    expect(r.ok && r.payload.customer_phone).toBe(null)
  })

  it('reports each problem', () => {
    const r = validateOrderDraft(
      draft({
        customer_name: '',
        customer_phone: '12345',
        due_date: '2026-10-01',
        discount: '5000',
        lines: [line({ quantity: 0 })],
      }),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual([
        'customer_name',
        'customer_phone',
        'discount',
        'due_date',
        'lines',
      ])
    }
  })
})
