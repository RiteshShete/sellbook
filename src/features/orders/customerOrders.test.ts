import { describe, expect, it } from 'vitest'
import { orderUpiNote } from '../../lib/upi'
import { actionReasons, addressText, customerMessage, mapsLink, whatsappToCustomer } from './customerOrders'

type S = Parameters<typeof actionReasons>[0]
const base: S = { source: 'customer', status: 'new', confirmation_status: 'pending', payment_status: 'pending', payment_claim_status: 'none' }
const reasons = (over: Partial<S>) => actionReasons({ ...base, ...over })

describe('actionReasons', () => {
  it('a new customer order waits for confirmation', () => expect(reasons({})).toEqual(['confirm']))

  it('a payment claim needs checking, even before the order is confirmed (both are listed)', () => {
    expect(reasons({ payment_claim_status: 'claimed' })).toEqual(['confirm', 'verify'])
    expect(reasons({ confirmation_status: 'confirmed', payment_claim_status: 'claimed' })).toEqual(['verify'])
  })

  it('a confirmed order with nothing to check needs nothing', () => {
    expect(reasons({ confirmation_status: 'confirmed' })).toEqual([])
  })

  it('a declined order is a refund reminder only if money was paid or claimed', () => {
    const declined = { confirmation_status: 'declined', status: 'cancelled' } as const
    expect(reasons({ ...declined })).toEqual([])
    expect(reasons({ ...declined, payment_status: 'paid' })).toEqual(['refund'])
    expect(reasons({ ...declined, payment_claim_status: 'claimed' })).toEqual(['refund'])
  })

  it('a customer-cancelled order and the shop owner\'s own orders never need action', () => {
    expect(reasons({ status: 'cancelled' })).toEqual([])
    expect(reasons({ source: 'owner' })).toEqual([])
    expect(reasons({ source: null })).toEqual([])
  })
})

describe('customerMessage', () => {
  const v = { name: 'Asha', no: 12, shop: 'Ritesh Foods', total: 34000, date: '25 Nov', reason: 'Out of stock' }
  it('confirmed, declined, ready and paid', () => {
    expect(customerMessage('confirmed', v)).toBe('Hi Asha, your order #12 from Ritesh Foods is confirmed for 25 Nov. Total ₹340.')
    expect(customerMessage('declined', v)).toBe("Sorry Asha, we can't take order #12: Out of stock.")
    expect(customerMessage('ready', v)).toBe('Hi Asha, your order #12 is ready.')
    expect(customerMessage('paid', v)).toBe('Hi Asha, we received ₹340 for order #12. Thank you!')
  })
  it('leaves out the date or reason when there is none', () => {
    expect(customerMessage('confirmed', { ...v, date: undefined })).not.toMatch(/ for \d/)
    expect(customerMessage('declined', { ...v, reason: undefined })).toBe("Sorry Asha, we can't take order #12.")
  })
})

describe('links', () => {
  const addr = { name: 'Asha', phone: '919876543210', line1: '12 Market Road', line2: null, area: null, landmark: 'Near temple', city: 'Pune', pincode: '411001' }
  it('writes the address on one line without empty parts', () => {
    expect(addressText(addr)).toBe('12 Market Road, Near temple, Pune 411001')
  })
  it('opens maps with the address encoded', () => {
    expect(mapsLink(addr)).toBe('https://www.google.com/maps/search/?api=1&query=12%20Market%20Road%2C%20Near%20temple%2C%20Pune%20411001')
  })
  it('builds a WhatsApp link only for a valid number', () => {
    expect(whatsappToCustomer('919876543210', 'Hi there')).toBe('https://wa.me/919876543210?text=Hi%20there')
    expect(whatsappToCustomer(null, 'x')).toBeNull()
    expect(whatsappToCustomer('123', 'x')).toBeNull()
  })
})

describe('orderUpiNote', () => {
  it('is "Order N Shop", ASCII only, and short', () => {
    expect(orderUpiNote(12, 'Ritesh Foods')).toBe('Order 12 Ritesh Foods')
    expect(orderUpiNote(12, 'Café — कण्हेरी Foods')).toBe('Order 12 Caf Foods')
    expect(orderUpiNote(7, 'कण्हेरी')).toBe('Order 7')
    expect(orderUpiNote(1, 'x'.repeat(100)).length).toBeLessThanOrEqual(40)
  })
})
