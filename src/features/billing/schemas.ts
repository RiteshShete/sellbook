import { z } from 'zod'
import { dbMoney } from '../../lib/zodMoney'
import { formatINR, type Paise } from '../../lib/money'
import { billMessage, upiLinkForBill } from '../../lib/upi'
import { OrderItemSchema, OrderSchema, type Order } from '../orders/schemas'
import type { Settings } from '../settings/schemas'

/** One generated bill image (a revision). Rows are insert-only; old revisions are kept. */
export const BillSchema = z.object({
  id: z.guid(),
  order_id: z.guid(),
  bill_no: z.number().int(),
  revision: z.number().int(),
  image_path: z.string(),
  total_at_generation: dbMoney,
  items_hash: z.string(),
  generated_at: z.string(),
})
export type Bill = z.infer<typeof BillSchema>

/** What reserve_bill_number returns: the order as it is now, its bill no. and content hash. */
export const BillSourceSchema = OrderSchema.extend({
  bill_no: z.number().int(),
  items: z.array(OrderItemSchema),
  content_hash: z.string(),
}).transform((o) => ({ ...o, items: [...o.items].sort((a, b) => a.position - b.position) }))
export type BillSource = z.infer<typeof BillSourceSchema>

/** Revisions newest first, plus the order's current content hash (B7). */
export interface BillState {
  bills: Bill[]
  currentHash: string
}

/** The bills storage bucket rejects files over this (500 KB); renderBill shrinks the PNG to fit. */
export const MAX_BILL_BYTES = 500 * 1024

/** A bill this tall is still well under the iOS canvas limit at 2x. */
export const MAX_BILL_LINES = 60

/** "INV" + 7 -> "INV-0007"; an empty prefix gives "0007". */
export function formatBillNo(prefix: string, billNo: number): string {
  const n = String(billNo).padStart(4, '0')
  return prefix ? `${prefix}-${n}` : n
}

/** File name offered when sharing / saving: "INV-0007.png". */
export function billFileName(prefix: string, billNo: number): string {
  return `${formatBillNo(prefix, billNo)}.png`
}

/** B7: the latest bill no longer matches the order's items / discount / total. */
export function isOutdated(state: BillState): boolean {
  const latest = state.bills[0]
  return latest !== undefined && latest.items_hash !== state.currentHash
}

type PayOrder = Pick<Order, 'customer_name' | 'payment_status'>
type PaySettings = Pick<
  Settings,
  'shop_name' | 'upi_id' | 'payee_name' | 'use_dynamic_qr' | 'qr_path'
>

/** The upi://pay link for a bill, or null (not in dynamic mode, already paid, or nothing to pay). */
export function billUpiLink(
  order: Pick<Order, 'payment_status'>,
  settings: PaySettings,
  billNo: string,
  total: Paise,
): string | null {
  return upiLinkForBill({ settings, billNo, amount: total, paid: order.payment_status === 'paid' })
}

/** The message shared with the bill: amount plus a upi://pay link when the bill has a dynamic QR. */
export function billShareText(
  order: PayOrder,
  settings: PaySettings,
  billNo: string,
  total: Paise,
): string {
  return billMessage({
    customerName: order.customer_name,
    shopName: settings.shop_name,
    billNo,
    totalText: formatINR(total),
    upiLink: billUpiLink(order, settings, billNo, total),
    paid: order.payment_status === 'paid',
  })
}
