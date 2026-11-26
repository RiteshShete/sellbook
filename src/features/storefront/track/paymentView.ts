import type { CustomerOrder } from '../types'
import { orderEnding } from './timeline'

/**
 * What the customer's payment area shows (STOREFRONT_PLAN 11.1):
 * none = nothing to show, paid = confirmed, cod = pay when it arrives, waiting = said they paid, the shop is checking,
 * pay = pay now, rejected = the shop did not see it (try again), limit = three claims used (message the shop).
 */
export type PaymentView = 'none' | 'paid' | 'cod' | 'waiting' | 'pay' | 'rejected' | 'limit'

export const MAX_CLAIMS = 3

type PaymentOrder = Pick<CustomerOrder, 'status' | 'confirmation_status' | 'payment_status' | 'payment_claim_status' | 'claim_count' | 'payment'>

export function paymentView(o: PaymentOrder): PaymentView {
  if (orderEnding(o) !== null) return 'none'
  if (o.payment_status === 'paid') return 'paid'
  if (o.payment.method === 'cod') return 'cod'
  if (o.payment_claim_status === 'claimed') return 'waiting'
  if (o.payment.upi_id === null) return 'none' // the server only sends UPI details while the order is an unpaid UPI order
  if (o.claim_count >= MAX_CLAIMS) return 'limit'
  return o.payment_claim_status === 'rejected' ? 'rejected' : 'pay'
}
