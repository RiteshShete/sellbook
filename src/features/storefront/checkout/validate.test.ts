import { describe, expect, it } from 'vitest'
import { shop } from '../store.fixtures'
import { dateRange, fulfilmentOptions, hasErrors, paymentOptions, validateCheckout, type CheckoutInput } from './validate'

const TODAY = '2026-11-24'
const good: CheckoutInput = {
  fulfilment: 'delivery',
  addressId: null,
  address: { name: 'Asha', phone: '9876543210', line1: '12 Market Road', line2: '', area: '', city: 'Pune', pincode: '411001', landmark: '' },
  requestedFor: '2026-11-25',
  notes: '',
  method: 'upi',
}
const check = (over: Partial<CheckoutInput>, s = shop()) => validateCheckout({ ...good, ...over }, s, TODAY)

describe('validateCheckout', () => {
  it('accepts a complete order', () => expect(hasErrors(check({}))).toBe(false))

  it('refuses a date before the server earliest date and after 30 days (IST)', () => {
    expect(check({ requestedFor: '2026-11-24' }).date).toMatch(/earliest date is 2026-11-25/)
    expect(check({ requestedFor: '2026-12-24' }).date).toBeUndefined() // exactly 30 days from 24 Nov
    expect(check({ requestedFor: '2026-12-25' }).date).toMatch(/30 days/)
    expect(check({ requestedFor: '' }).date).toBe('Choose a date')
  })

  it('dateRange runs from the server earliest date to today + 30', () => {
    expect(dateRange(shop(), TODAY)).toEqual({ min: '2026-11-25', max: '2026-12-24' })
  })

  it('needs a delivery address, but not for pickup or a saved address', () => {
    const empty = { ...good.address, line1: '', pincode: '12' }
    expect(Object.keys(check({ address: empty }))).toEqual(expect.arrayContaining(['line1', 'pincode']))
    expect(hasErrors(check({ address: empty, fulfilment: 'pickup' }))).toBe(false)
    expect(hasErrors(check({ address: empty, addressId: '11111111-1111-4111-8111-111111111111' }))).toBe(false)
  })

  it('checks the mobile number and pincode shapes', () => {
    expect(check({ address: { ...good.address, phone: '12345' } }).phone).toBeDefined()
    expect(check({ address: { ...good.address, pincode: '011001' } }).pincode).toBeDefined()
  })

  it('only allows what the shop offers', () => {
    const pickupOnlyCod = shop({ delivery_mode: 'pickup', pay_upi: false })
    expect(fulfilmentOptions(pickupOnlyCod)).toEqual(['pickup'])
    expect(paymentOptions(pickupOnlyCod)).toEqual(['cod'])
    expect(check({ fulfilment: 'delivery' }, pickupOnlyCod).fulfilment).toBeDefined()
    expect(check({ fulfilment: 'pickup', method: 'upi' }, pickupOnlyCod).method).toBeDefined()
    expect(hasErrors(check({ fulfilment: 'pickup', method: 'cod' }, pickupOnlyCod))).toBe(false)
  })

  it('limits the note to 300 characters', () => {
    expect(check({ notes: 'x'.repeat(301) }).notes).toBeDefined()
    expect(check({ notes: 'x'.repeat(300) }).notes).toBeUndefined()
  })
})
