import { toCsv } from '../../lib/csv'
import { todayIST } from '../../lib/dates'
import { formatPhone } from '../../lib/format'
import { paiseToDecimalString } from '../../lib/money'
import { formatBillNo } from '../billing/schemas'
import type { ExportRow } from './schemas'

const HEADER = [
  'Order no',
  'Bill no',
  'Order date',
  'Delivered on',
  'Customer',
  'Phone',
  'Items',
  'Units',
  'Discount (₹)',
  'Total (₹)',
  'Payment',
  'Mode',
  'Paid on',
]

/** IST calendar day "YYYY-MM-DD": Excel and Sheets both read it as a date. */
const istDay = (ts: string) => todayIST(new Date(ts))

/** "98765 43210": a leading "+" would make Excel treat the phone as a number or formula. */
function phoneCell(phone: string | null): string {
  return phone ? formatPhone(phone).replace(/^\+91 /, '') : ''
}

/**
 * The month's delivered orders as CSV (same set as Sales). Amounts are plain decimals
 * ("900.00") so spreadsheets can add them up; ₹ is only in the headers.
 */
export function buildOrdersCsv(rows: ExportRow[], fallbackPrefix: string): string {
  return toCsv([
    HEADER,
    ...rows.map((r) => [
      r.order_no,
      r.bill_no === null ? '' : formatBillNo(r.bill_prefix ?? fallbackPrefix, r.bill_no),
      r.order_date,
      istDay(r.delivered_at),
      r.customer_name,
      phoneCell(r.customer_phone),
      r.items,
      r.units,
      paiseToDecimalString(r.discount),
      paiseToDecimalString(r.total),
      r.payment_status,
      r.payment_mode ?? '',
      r.paid_at ? istDay(r.paid_at) : '',
    ]),
  ])
}

export function csvFileName(month: string): string {
  return `sellbook-orders-${month}.csv`
}
