import { z } from 'zod'
import { formatDate } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { dbMoney } from '../../lib/zodMoney'
import { STATUS_LABEL, paymentLabel, paymentState } from './pipeline'
import { ORDER_STATUSES } from './schemas'

/** The parts of an order_versions.snapshot the history screen shows and compares. */
export const SnapshotSchema = z.object({
  customer_name: z.string(),
  customer_phone: z.string().nullable(),
  order_date: z.string(),
  due_date: z.string().nullable(),
  notes: z.string().nullable(),
  discount: dbMoney,
  total: dbMoney,
  status: z.enum(ORDER_STATUSES),
  payment_status: z.enum(['pending', 'paid']),
  payment_mode: z.enum(['online', 'cash']).nullable(),
  items: z.array(
    z.object({
      product_name: z.string(),
      variant_name: z.string(),
      unit_price: dbMoney,
      quantity: z.number().int(),
    }),
  ),
})
export type Snapshot = z.infer<typeof SnapshotSchema>

export const VersionSchema = z.object({
  version_no: z.number().int(),
  reason: z.enum(['create', 'edit', 'status', 'payment', 'delete', 'restore', 'rollback']),
  summary: z.string().nullable(),
  created_at: z.string(),
  snapshot: SnapshotSchema,
})
export type Version = z.infer<typeof VersionSchema>

type Item = Snapshot['items'][number]
const itemKey = (i: Item) => `${i.product_name} ${i.variant_name} @${i.unit_price}`
const itemName = (i: Item) => `${i.product_name} ${i.variant_name}`

function quantities(items: Item[]): Map<string, { item: Item; qty: number }> {
  const m = new Map<string, { item: Item; qty: number }>()
  for (const i of items) {
    const k = itemKey(i)
    m.set(k, { item: i, qty: (m.get(k)?.qty ?? 0) + i.quantity })
  }
  return m
}

const day = (d: string | null) => (d ? formatDate(d) : 'none')

/** Human lines describing what changed from `prev` to `cur` (empty if nothing visible). */
export function versionDiff(prev: Snapshot, cur: Snapshot): string[] {
  const out: string[] = []
  if (prev.customer_name !== cur.customer_name) {
    out.push(`Name: ${prev.customer_name} → ${cur.customer_name}`)
  }
  if (prev.customer_phone !== cur.customer_phone) out.push('Phone changed')
  if (prev.order_date !== cur.order_date) {
    out.push(`Order date: ${day(prev.order_date)} → ${day(cur.order_date)}`)
  }
  if (prev.due_date !== cur.due_date) out.push(`Due: ${day(prev.due_date)} → ${day(cur.due_date)}`)
  if (prev.notes !== cur.notes) out.push('Notes changed')

  const a = quantities(prev.items)
  const b = quantities(cur.items)
  for (const [k, { item, qty }] of b) {
    const before = a.get(k)?.qty
    if (before === undefined) out.push(`+ ${itemName(item)} ×${qty}`)
    else if (before !== qty) out.push(`${itemName(item)}: ${before} → ${qty}`)
  }
  for (const [k, { item, qty }] of a) {
    if (!b.has(k)) out.push(`− ${itemName(item)} ×${qty}`)
  }

  if (prev.discount !== cur.discount) {
    out.push(`Discount: ${formatINR(prev.discount)} → ${formatINR(cur.discount)}`)
  }
  if (prev.total !== cur.total)
    out.push(`Total: ${formatINR(prev.total)} → ${formatINR(cur.total)}`)
  if (prev.status !== cur.status) {
    out.push(`Status: ${STATUS_LABEL[prev.status]} → ${STATUS_LABEL[cur.status]}`)
  }
  const pp = paymentLabel(paymentState(prev))
  const cp = paymentLabel(paymentState(cur))
  if (pp !== cp) out.push(`Payment: ${pp} → ${cp}`)
  return out
}
