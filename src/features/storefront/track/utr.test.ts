import { describe, expect, it } from 'vitest'
import { cleanUtr, utrProblem } from './utr'

describe('cleanUtr', () => {
  it('keeps digits only and at most 12 (a pasted "UTR: 1234 5678 9012" works)', () => {
    expect(cleanUtr('UTR: 1234 5678 9012')).toBe('123456789012')
    expect(cleanUtr('1234567890123456')).toBe('123456789012')
    expect(cleanUtr('abc')).toBe('')
  })
})

describe('utrProblem', () => {
  it('accepts nothing or a full 12 digits, and flags anything in between', () => {
    expect(utrProblem('')).toBeNull()
    expect(utrProblem('   ')).toBeNull()
    expect(utrProblem('123456789012')).toBeNull()
    expect(utrProblem('12345')).toBe('incomplete')
  })
})
