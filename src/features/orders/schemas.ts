import { z } from 'zod'
import {
  addMoney,
  multiplyMoney,
  paiseToDecimalString,
  parseMoneyInput,
  type Paise,
} from '../../lib/money'
import { SizeUnitSchema, dbAmount, type SizeUnit } from '../../lib/measure'
import { normalizePhone, toNationalPhone } from '../../lib/phone'
import { dbMoney } from '../../lib/zodMoney'

// ---- Rows from the database ----------------------------------------------------------------------

export const ORDER_STATUSES = ['new', 'ready', 'delivered', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const OrderSchema = z.object({
  id: z.guid(),
  order_no: z.number().int(),
  customer_name: z.string(),
  customer_phone: z.string().nullable(),
  order_date: DateOnly,
  due_date: DateOnly.nullable(),
  notes: z.string().nullable(),
  status: z.enum(ORDER_STATUSES),
  payment_status: z.enum(['pending', 'paid']),
  payment_mode: z.enum(['online', 'cash']).nullable(),
  discount: dbMoney,
  total: dbMoney,
  bill_no: z.number().int().nullable(),
  /**
   * Prefix snapshotted with bill_no (B6), so a later Settings change never relabels a bill.
   * Nullish until migration 20261014100000 is applied; readers then fall back to Settings.
   */
  bill_prefix: z.string().nullish(),
  version_no: z.number().int(),
  created_at: z.string(),
  ready_at: z.string().nullable(),
  delivered_at: z.string().nullable(),
  paid_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  cancelled_from: z.enum(ORDER_STATUSES).nullable(),
})
export type Order = z.infer<typeof OrderSchema>

export const OrderItemSchema = z.object({
  id: z.guid(),
  variant_id: z.guid().nullable(),
  product_name: z.string(),
  variant_name: z.string(),
  unit_price: dbMoney,
  quantity: z.number().int(),
  line_total: dbMoney,
  position: z.number().int(),
  /** Size snapshot (base units); null when the variant had no size when ordered (B8). */
  size_amount: dbAmount.nullish(),
  size_unit: SizeUnitSchema.nullish(),
})
export type OrderItem = z.infer<typeof OrderItemSchema>

/** A line's own size snapshot, or null. Never the catalog's current size (B8; same as DB). */
export function itemSize(i: OrderItem): { unit: SizeUnit; amount: number } | null {
  return i.size_unit && i.size_amount != null ? { unit: i.size_unit, amount: i.size_amount } : null
}

export const OrderWithItemsSchema = OrderSchema.extend({
  order_items: z.array(OrderItemSchema),
}).transform(({ order_items, ...order }) => ({
  ...order,
  items: [...order_items].sort((a, b) => a.position - b.position),
}))
export type OrderWithItems = z.infer<typeof OrderWithItemsSchema>

/** List row: the order plus its unit count and a one-line "2× Cake 1 kg, …" summary. */
export const OrderListRowSchema = OrderSchema.extend({
  order_items: z.array(
    z.object({
      quantity: z.number().int(),
      product_name: z.string(),
      variant_name: z.string(),
      position: z.number().int(),
    }),
  ),
}).transform(({ order_items, ...order }) => {
  const items = [...order_items].sort((a, b) => a.position - b.position)
  return {
    ...order,
    units: items.reduce((n, i) => n + i.quantity, 0),
    itemsSummary: items.map((i) => `${i.quantity}× ${i.product_name} ${i.variant_name}`).join(', '),
  }
})
export type OrderListRow = z.infer<typeof OrderListRowSchema>

export const CustomerSuggestionSchema = z.object({
  customer_name: z.string(),
  customer_phone: z.string().nullable(),
  last_order_date: DateOnly,
})
export type CustomerSuggestion = z.infer<typeof CustomerSuggestionSchema>

// ---- Order form ----------------------------------------------------------------------------------

export interface LineDraft {
  /** Stable React key; equals the item id for saved lines. */
  key: string
  /** Saved item id: the server keeps this line's snapshot price. */
  id?: string
  variant_id: string | null
  product_name: string
  variant_name: string
  unit_price: Paise
  quantity: number
}

export interface OrderDraft {
  customer_name: string
  customer_phone: string
  order_date: string
  due_date: string
  notes: string
  discount: string
  lines: LineDraft[]
}

export interface OrderPayload {
  customer_name: string
  customer_phone: string | null
  order_date: string
  due_date: string | null
  notes: string | null
  discount: string
  items: { id?: string; variant_id: string | null; quantity: number }[]
}

export type OrderErrors = Partial<
  Record<
    'customer_name' | 'customer_phone' | 'order_date' | 'due_date' | 'discount' | 'lines',
    string
  >
>

export type OrderValidation =
  { ok: true; payload: OrderPayload } | { ok: false; errors: OrderErrors }

export const MAX_QTY = 100000

export function draftFromOrder(o: OrderWithItems): OrderDraft {
  return {
    customer_name: o.customer_name,
    customer_phone: o.customer_phone ? toNationalPhone(o.customer_phone) : '',
    order_date: o.order_date,
    due_date: o.due_date ?? '',
    notes: o.notes ?? '',
    // Exact decimal text, trailing zeros trimmed: "30.50" -> "30.5", "300.00" -> "300".
    discount: o.discount === 0 ? '' : paiseToDecimalString(o.discount).replace(/\.?0+$/, ''),
    lines: o.items.map((i) => ({
      key: i.id,
      id: i.id,
      variant_id: i.variant_id,
      product_name: i.product_name,
      variant_name: i.variant_name,
      unit_price: i.unit_price,
      quantity: i.quantity,
    })),
  }
}

/** Same arithmetic as the database (B3), in paise: subtotal - discount, never below 0. */
export function draftTotals(lines: LineDraft[], discountText: string) {
  // A half-typed quantity (NaN) counts as 0 here; validateOrderDraft reports it.
  const subtotal = addMoney(
    ...lines.map((l) =>
      multiplyMoney(l.unit_price, Number.isSafeInteger(l.quantity) ? l.quantity : 0),
    ),
  )
  const discount = discountText.trim() === '' ? 0 : (parseMoneyInput(discountText) ?? 0)
  return { subtotal, discount, total: Math.max(0, subtotal - discount) }
}

export function validateOrderDraft(d: OrderDraft): OrderValidation {
  const errors: OrderErrors = {}
  const name = d.customer_name.trim()
  if (!name) errors.customer_name = 'Enter the customer name'
  else if (name.length > 100) errors.customer_name = 'Keep it under 100 characters'

  const phone = d.customer_phone.trim() === '' ? null : normalizePhone(d.customer_phone)
  if (d.customer_phone.trim() !== '' && phone === null) {
    errors.customer_phone = 'Enter a 10-digit Indian mobile number'
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.order_date)) errors.order_date = 'Pick the order date'
  if (d.due_date && d.due_date < d.order_date) errors.due_date = 'Due date is before the order date'

  const { subtotal } = draftTotals(d.lines, d.discount)
  const discount = d.discount.trim() === '' ? 0 : parseMoneyInput(d.discount)
  if (discount === null) errors.discount = 'Enter an amount, or leave empty'
  else if (discount > subtotal) errors.discount = 'Discount is more than the items total'

  if (
    d.lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > MAX_QTY)
  ) {
    errors.lines = `Quantities must be whole numbers from 1 to ${MAX_QTY}`
  }

  if (Object.keys(errors).length > 0 || discount === null) return { ok: false, errors }
  return {
    ok: true,
    payload: {
      customer_name: name,
      customer_phone: phone,
      order_date: d.order_date,
      due_date: d.due_date || null,
      notes: d.notes.trim() || null,
      discount: paiseToDecimalString(discount),
      items: d.lines.map((l) => ({
        ...(l.id ? { id: l.id } : {}),
        variant_id: l.variant_id,
        quantity: l.quantity,
      })),
    },
  }
}
