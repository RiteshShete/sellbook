import { describe, expect, it } from 'vitest'
import { ERROR_CODES } from './contract'
import { customerErrorMessage, GENERIC_ERROR } from './errors'

describe('customerErrorMessage', () => {
  it('has a customer sentence for every storefront error code', () => {
    for (const code of Object.keys(ERROR_CODES).filter((c) => c !== 'SB409' && c !== 'SB421' && c !== 'SB423')) {
      expect(customerErrorMessage({ code })).not.toBe(GENERIC_ERROR)
    }
  })

  it('keeps the server sentence for the minimum order and the date', () => {
    expect(customerErrorMessage({ code: 'SB421', message: 'the minimum order is Rs 200.00' })).toBe(
      'The minimum order is Rs 200.00.',
    )
    expect(customerErrorMessage({ code: 'SB423', message: 'the earliest date is 25 Nov' })).toBe(
      'The earliest date is 25 Nov.',
    )
  })

  it('never shows SQL, plan or owner words, even when the server message has them', () => {
    const codes = ['SB420', 'SB422', 'SB424', 'SB425', 'SB426', 'SB427', 'SB428', 'SB429', 'SB411', '23505', 'weird']
    for (const code of codes) {
      const text = customerErrorMessage({ code, message: 'violates constraint orders_pkey on plan trial_orders' })
      expect(text).not.toMatch(/plan|owner|constraint|sql|trial/i)
    }
  })

  it('falls back to a generic message for anything unknown', () => {
    expect(customerErrorMessage(null)).toBe(GENERIC_ERROR)
    expect(customerErrorMessage(new Error('boom'))).toBe(GENERIC_ERROR)
  })
})
