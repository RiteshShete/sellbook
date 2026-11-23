import { describe, expect, it } from 'vitest'
import { PlaceOrderRequest } from '../contract'
import { V_CHAKLI, V_LADOO } from '../store.fixtures'
import { addLine, EMPTY_CART } from '../cart/cartStore'
import { buildPlaceOrder } from './buildRequest'
import type { CheckoutInput } from './validate'

const KEY = '22222222-2222-4222-8222-222222222222'
const cart = addLine(addLine(EMPTY_CART, V_CHAKLI, 12000, 2), V_LADOO, 10000, 1)
const input: CheckoutInput = {
  fulfilment: 'delivery',
  addressId: null,
  address: { name: ' Asha ', phone: '98765 43210', line1: '12 Market Road', line2: '', area: '', city: 'Pune', pincode: '411001', landmark: '' },
  requestedFor: '2026-11-25',
  notes: '  ',
  method: 'upi',
}

describe('buildPlaceOrder', () => {
  it('sends only ids and quantities (never a price or total) and passes the server schema', () => {
    const body = buildPlaceOrder('a-foods', cart, input, KEY)
    expect(body.items).toEqual([{ variant_id: V_CHAKLI, qty: 2 }, { variant_id: V_LADOO, qty: 1 }])
    expect(JSON.stringify(body)).not.toMatch(/price|total|owner|seen/i)
    expect(PlaceOrderRequest.safeParse(body).success).toBe(true)
  })

  it('cleans the address: trimmed, mobile in digits with country code, blank optional fields left out', () => {
    const body = buildPlaceOrder('a-foods', cart, input, KEY)
    expect(body.address).toEqual({ name: 'Asha', phone: '919876543210', line1: '12 Market Road', line2: undefined, area: undefined, city: 'Pune', pincode: '411001', landmark: undefined })
    expect(body.notes).toBeUndefined()
  })

  it('uses a saved address by id and sends no address object', () => {
    const body = buildPlaceOrder('a-foods', cart, { ...input, addressId: '11111111-1111-4111-8111-111111111111' }, KEY)
    expect(body.address_id).toBe('11111111-1111-4111-8111-111111111111')
    expect(body.address).toBeUndefined()
    expect(PlaceOrderRequest.safeParse(body).success).toBe(true)
  })

  it('pickup sends no address at all', () => {
    const body = buildPlaceOrder('a-foods', cart, { ...input, fulfilment: 'pickup' }, KEY)
    expect(body.address).toBeUndefined()
    expect(body.address_id).toBeUndefined()
    expect(PlaceOrderRequest.safeParse(body).success).toBe(true)
  })

  it('carries the idempotency key', () => {
    expect(buildPlaceOrder('a-foods', cart, input, KEY).idempotency_key).toBe(KEY)
  })
})
