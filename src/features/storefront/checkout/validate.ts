import { addDaysIST, todayIST } from '../../../lib/dates'
import { normalizePhone } from '../../../lib/phone'
import { LIMITS } from '../contract'
import type { StoreShop } from '../types'

export interface AddressInput {
  name: string
  phone: string
  line1: string
  line2: string
  area: string
  city: string
  pincode: string
  landmark: string
}

export interface CheckoutInput {
  fulfilment: 'delivery' | 'pickup'
  /** A saved address (its id) or null to use `address`. */
  addressId: string | null
  address: AddressInput
  requestedFor: string
  notes: string
  method: 'upi' | 'cod'
}

export type CheckoutErrors = Partial<Record<'fulfilment' | 'method' | 'date' | 'notes' | 'name' | 'phone' | 'line1' | 'city' | 'pincode', string>>

/** Which ways of getting the order this shop offers. */
export const fulfilmentOptions = (shop: StoreShop): ('delivery' | 'pickup')[] =>
  shop.delivery_mode === 'both' ? ['delivery', 'pickup'] : [shop.delivery_mode]

export const paymentOptions = (shop: StoreShop): ('upi' | 'cod')[] => [
  ...(shop.pay_upi ? (['upi'] as const) : []),
  ...(shop.pay_cod ? (['cod'] as const) : []),
]

/** The dates a customer may pick: from the server's earliest date to 30 days ahead (IST). */
export const dateRange = (shop: StoreShop, today: string = todayIST()) => ({
  min: shop.earliest_date,
  max: addDaysIST(today, LIMITS.maxAdvanceDays),
})

/**
 * The same checks the server makes, so a customer sees the problem next to the field. The server stays the authority
 * (place_order repeats every one).
 */
export function validateCheckout(input: CheckoutInput, shop: StoreShop, today: string = todayIST()): CheckoutErrors {
  const e: CheckoutErrors = {}
  if (!fulfilmentOptions(shop).includes(input.fulfilment)) e.fulfilment = 'Choose how you want to get your order'
  if (!paymentOptions(shop).includes(input.method)) e.method = 'Choose how you will pay'

  const { min, max } = dateRange(shop, today)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.requestedFor)) e.date = 'Choose a date'
  else if (input.requestedFor < min) e.date = `The earliest date is ${min}`
  else if (input.requestedFor > max) e.date = 'Choose a date within the next 30 days'

  if (input.notes.trim().length > 300) e.notes = 'Keep the note under 300 characters'

  if (input.fulfilment === 'delivery' && input.addressId === null) Object.assign(e, validateAddress(input.address))
  return e
}

/** The address checks alone (checkout and the saved-address form share them). */
export function validateAddress(a: AddressInput): CheckoutErrors {
  const e: CheckoutErrors = {}
  if (a.name.trim().length < 1 || a.name.trim().length > 100) e.name = 'Enter the name for delivery'
  if (normalizePhone(a.phone) === null) e.phone = 'Enter a valid 10-digit mobile number'
  if (a.line1.trim().length < 1 || a.line1.trim().length > 200) e.line1 = 'Enter the address'
  if (a.city.trim().length < 1 || a.city.trim().length > 100) e.city = 'Enter the city'
  if (!/^[1-9][0-9]{5}$/.test(a.pincode.trim())) e.pincode = 'Enter the 6-digit pincode'
  return e
}

export const hasErrors = (e: CheckoutErrors): boolean => Object.keys(e).length > 0
