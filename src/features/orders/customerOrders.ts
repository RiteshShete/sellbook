import { formatINR } from '../../lib/money'
import { toWaMeLink } from '../../lib/phone'
import type { AddressSnapshot, Order } from './schemas'

/** An order the customer placed on the storefront (the shop owner's own orders have no confirmation step). */
export const isCustomerOrder = (o: Pick<Order, 'source'>): boolean => o.source === 'customer'

export type ActionReason = 'confirm' | 'verify' | 'refund' | 'collect'

type OrderState = Pick<Order, 'source' | 'status' | 'confirmation_status' | 'payment_status' | 'payment_claim_status'> & Partial<Pick<Order, 'payment_method' | 'refund_done_at'>>

/**
 * Why a customer order needs the shop: it waits to be confirmed, the customer says they paid (check your bank), or it
 * was declined after money was paid or claimed (refund by hand). An order can need two things at once.
 */
export function actionReasons(o: OrderState): ActionReason[] {
  if (!isCustomerOrder(o)) return []
  if (o.confirmation_status === 'declined') {
    return !o.refund_done_at && (o.payment_status === 'paid' || o.payment_claim_status === 'claimed') ? ['refund'] : []
  }
  if (o.status === 'cancelled') return []
  const reasons: ActionReason[] = []
  if (o.confirmation_status === 'pending') reasons.push('confirm')
  if (o.payment_claim_status === 'claimed') reasons.push('verify')
  // Pay on delivery and ready to hand over: remind the shop to collect the cash.
  if (o.status === 'ready' && o.payment_method === 'cod' && o.payment_status === 'pending') reasons.push('collect')
  return reasons
}

/** Server-side filter (PostgREST or()) for the orders that may need action; actionReasons() makes the final call. */
export const NEEDS_ACTION_FILTER =
  'and(confirmation_status.eq.pending,status.neq.cancelled),payment_claim_status.eq.claimed,and(confirmation_status.eq.declined,payment_status.eq.paid,refund_done_at.is.null),and(status.eq.ready,payment_method.eq.cod,payment_status.eq.pending)'

/** "3 h" / "1 day" when a customer order has waited this long for confirmation (2 hours or more), else null. */
export function waitedLabel(createdAt: string, now: number = Date.now()): string | null {
  const hours = Math.floor((now - Date.parse(createdAt)) / 3_600_000)
  if (!Number.isFinite(hours) || hours < 2) return null
  return hours >= 24 ? `${Math.floor(hours / 24)} day${hours >= 48 ? 's' : ''}` : `${hours} h`
}

export const DECLINE_REASONS = [
  { value: 'Out of stock', label: 'Out of stock' },
  { value: 'Too far for delivery', label: 'Too far' },
  { value: 'We are closed', label: 'Closed' },
  { value: 'Other', label: 'Other' },
] as const

/** The sentence the owner sends the customer by WhatsApp (one tap; English until the Marathi wording is reviewed). */
export type MessageKind = 'confirmed' | 'declined' | 'ready' | 'paid'

export function customerMessage(
  kind: MessageKind,
  v: { name: string; no: number; shop: string; total: number; date?: string; reason?: string },
): string {
  switch (kind) {
    case 'confirmed':
      return `Hi ${v.name}, your order #${v.no} from ${v.shop} is confirmed${v.date ? ` for ${v.date}` : ''}. Total ${formatINR(v.total)}.`
    case 'declined':
      return `Sorry ${v.name}, we can't take order #${v.no}${v.reason ? `: ${v.reason}` : ''}.`
    case 'ready':
      return `Hi ${v.name}, your order #${v.no} is ready.`
    case 'paid':
      return `Hi ${v.name}, we received ${formatINR(v.total)} for order #${v.no}. Thank you!`
  }
}

/** A wa.me link to the customer with the message filled in, or null when the order has no valid mobile number. */
export const whatsappToCustomer = (phone: string | null, text: string): string | null =>
  phone ? toWaMeLink(phone, text) : null

/** "12 Market Road, Near temple, Pune 411001" for display and for the maps link. */
export function addressText(a: AddressSnapshot): string {
  return [a.line1, a.line2, a.area, a.landmark, `${a.city} ${a.pincode}`].filter((p) => p && p.trim() !== '').join(', ')
}

/** Opens the address in the phone's maps app (built from the address text; nothing is sent anywhere by us). */
export const mapsLink = (a: AddressSnapshot): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText(a))}`
