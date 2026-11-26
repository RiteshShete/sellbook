import { describe, expect, it } from 'vitest'
import { cleanOtp, isOtpComplete, otpDigits, resendSecondsLeft } from './otp'

describe('cleanOtp', () => {
  it('keeps digits only', () => expect(cleanOtp('12 34-56')).toBe('123456'))
  it('cuts a longer paste to 6', () => expect(cleanOtp('123456789')).toBe('123456'))
  it('accepts a partial paste', () => expect(cleanOtp('12a')).toBe('12'))
  it('reads Devanagari digits', () => expect(cleanOtp('१२३४५६')).toBe('123456'))
  it('gives an empty string for no digits', () => expect(cleanOtp('abc')).toBe(''))
})

describe('isOtpComplete and otpDigits', () => {
  it('is complete only at 6 digits', () => {
    expect(isOtpComplete('12345')).toBe(false)
    expect(isOtpComplete('123456')).toBe(true)
  })
  it('spreads a partial code over six boxes', () => {
    expect(otpDigits('12')).toEqual(['1', '2', '', '', '', ''])
  })
})

describe('resendSecondsLeft', () => {
  it('counts down from 60 and stops at 0', () => {
    expect(resendSecondsLeft(0, 0)).toBe(60)
    expect(resendSecondsLeft(0, 1_000)).toBe(59)
    expect(resendSecondsLeft(0, 59_100)).toBe(1)
    expect(resendSecondsLeft(0, 60_000)).toBe(0)
    expect(resendSecondsLeft(0, 120_000)).toBe(0)
    // `now` can lag behind `sentAt` for a moment after sending: never show more than the wait
    expect(resendSecondsLeft(5_000, 0)).toBe(60)
  })
})
