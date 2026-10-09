import { z } from 'zod'
import { dbMoney } from '../../lib/zodMoney'
import { formatINR, type Paise } from '../../lib/money'
import { billMessage, upiPayLink } from '../../lib/upi'
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

/** The message shared with the bill: amount plus a upi://pay link when a UPI id is set. */
export function billShareText(
  order: Pick<Order, 'customer_name'>,
  settings: Pick<Settings, 'shop_name' | 'upi_id'>,
  billNo: string,
  total: Paise,
): string {
  const upiLink = settings.upi_id
    ? upiPayLink({
        upiId: settings.upi_id,
        payeeName: settings.shop_name || 'Shop',
        amount: total,
        note: `Bill ${billNo}`,
      })
    : null
  return billMessage({
    customerName: order.customer_name,
    shopName: settings.shop_name,
    billNo,
    totalText: formatINR(total),
    upiLink,
  })
}
