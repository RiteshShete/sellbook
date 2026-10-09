import { describe, expect, it } from 'vitest'
import { normalizePhone, toNationalPhone, toTelLink, toWaMeLink } from './phone'

describe('normalizePhone', () => {
  it('adds 91 to 10-digit numbers', () => {
    expect(normalizePhone('9876543210')).toBe('919876543210')
  })
  it('strips a leading 0', () => {
    expect(normalizePhone('09876543210')).toBe('919876543210')
  })
  it('keeps an existing country code and ignores punctuation', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('919876543210')
    expect(normalizePhone('919876543210')).toBe('919876543210')
    expect(normalizePhone('(+91) 98765 43210')).toBe('919876543210')
    expect(normalizePhone('0091 9876543210')).toBe('919876543210')
  })
  it('returns null for invalid numbers', () => {
    for (const bad of [
      '',
      'abc',
      '12345',
      '5876543210',
      '98765432101',
      '+1 415 555 0100',
      '99999',
    ]) {
      expect(normalizePhone(bad), bad).toBeNull()
    }
  })
})

describe('toWaMeLink', () => {
  it('builds a wa.me link', () => {
    expect(toWaMeLink('98765 43210')).toBe('https://wa.me/919876543210')
  })
  it('url-encodes the text', () => {
    expect(toWaMeLink('9876543210', 'Hi! Bill ₹1,250 & thanks')).toBe(
      'https://wa.me/919876543210?text=Hi!%20Bill%20%E2%82%B91%2C250%20%26%20thanks',
    )
  })
  it('returns null for an invalid phone', () => {
    expect(toWaMeLink('123')).toBeNull()
  })
})

describe('toNationalPhone / toTelLink', () => {
  it('drops the country code for the form and builds a tel: link', () => {
    expect(toNationalPhone('919876543210')).toBe('9876543210')
    expect(toTelLink('919876543210')).toBe('tel:+919876543210')
  })
  it('leaves an unexpected value readable', () => {
    expect(toNationalPhone('123')).toBe('123')
  })
})
