import { describe, expect, it } from 'vitest'
import { hasErrors, validateAddress } from './validate'

const ok = { name: 'Asha', phone: '9876543210', line1: '12 Market Rd', line2: '', area: '', city: 'Pune', pincode: '411001', landmark: '' }

describe('validateAddress', () => {
  it('accepts a good address', () => expect(hasErrors(validateAddress(ok))).toBe(false))
  it.each([
    ['name', { name: ' ' }],
    ['phone', { phone: '12345' }],
    ['line1', { line1: '' }],
    ['city', { city: '' }],
    ['pincode', { pincode: '01234' }],
  ])('flags a bad %s', (field, patch) => expect(validateAddress({ ...ok, ...patch })).toHaveProperty(field))
})
