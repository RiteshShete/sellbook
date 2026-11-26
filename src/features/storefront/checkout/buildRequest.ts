import type { z } from 'zod'
import { normalizePhone } from '../../../lib/phone'
import type { PlaceOrderRequest } from '../contract'
import type { Cart } from '../cart/cartStore'
import type { CheckoutInput } from './validate'

const blankToUndefined = (s: string) => (s.trim() === '' ? undefined : s.trim())

/**
 * The only thing the browser sends: variant ids and quantities, how and when, the address and the payment method.
 * No price, no total, no shop owner: the server works those out (and the schema refuses them).
 */
export function buildPlaceOrder(
  slug: string,
  cart: Cart,
  input: CheckoutInput,
  idempotencyKey: string,
): z.input<typeof PlaceOrderRequest> {
  const delivery = input.fulfilment === 'delivery'
  const a = input.address
  const phone = normalizePhone(a.phone)
  return {
    slug,
    items: cart.lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
    fulfilment: input.fulfilment,
    ...(delivery && input.addressId !== null ? { address_id: input.addressId } : {}),
    ...(delivery && input.addressId === null && phone
      ? {
          address: {
            name: a.name.trim(),
            phone,
            line1: a.line1.trim(),
            line2: blankToUndefined(a.line2),
            area: blankToUndefined(a.area),
            city: a.city.trim(),
            pincode: a.pincode.trim(),
            landmark: blankToUndefined(a.landmark),
          },
        }
      : {}),
    requested_for: input.requestedFor,
    notes: blankToUndefined(input.notes),
    payment_method: input.method,
    idempotency_key: idempotencyKey,
  }
}
