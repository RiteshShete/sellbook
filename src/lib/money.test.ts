import { describe, expect, it } from 'vitest'
import {
  addMoney,
  formatINR,
  fromPaise,
  multiplyMoney,
  paiseToDecimalString,
  parseMoneyInput,
  toPaise,
} from './money'

describe('toPaise rounding', () => {
  it('converts whole and fractional rupees', () => {
    expect(toPaise(1250)).toBe(125000)
    expect(toPaise(1250.5)).toBe(125050)
    expect(toPaise('99.99')).toBe(9999)
  })
  it('rounds half-up on decimal digits, not binary floats', () => {
    expect(toPaise(1.005)).toBe(101) // naive Math.round(1.005 * 100) gives 100
    expect(toPaise(0.285)).toBe(29)
    expect(toPaise('1.004')).toBe(100)
    expect(toPaise(0.1 + 0.2)).toBe(30)
  })
  it('handles negatives and zero', () => {
    expect(toPaise(-2.5)).toBe(-250)
    expect(toPaise('-0.005')).toBe(-1)
    expect(Object.is(toPaise(-0.001), 0)).toBe(true)
  })
  it('throws on garbage', () => {
    expect(() => toPaise('abc')).toThrow(RangeError)
    expect(() => toPaise(NaN)).toThrow(RangeError)
  })
})

describe('fromPaise / paiseToDecimalString', () => {
  it('round-trips', () => {
    expect(fromPaise(125050)).toBe(1250.5)
    expect(paiseToDecimalString(125050)).toBe('1250.50')
    expect(paiseToDecimalString(5)).toBe('0.05')
    expect(paiseToDecimalString(-150)).toBe('-1.50')
  })
  it('rejects non-integers', () => {
    expect(() => fromPaise(1.5)).toThrow(RangeError)
  })
})

describe('addMoney / multiplyMoney', () => {
  it('sums exactly', () => {
    expect(addMoney(10, 20, 30)).toBe(60)
    expect(addMoney()).toBe(0)
    expect(addMoney(toPaise(0.1), toPaise(0.2))).toBe(30)
  })
  it('multiplies by whole quantities only', () => {
    expect(multiplyMoney(12550, 3)).toBe(37650)
    expect(() => multiplyMoney(100, 1.5)).toThrow(RangeError)
  })
})

describe('formatINR', () => {
  it('uses rupee symbol and Indian grouping', () => {
    expect(formatINR(125000)).toBe('₹1,250')
    expect(formatINR(125050)).toBe('₹1,250.50')
    expect(formatINR(12500000)).toBe('₹1,25,000')
    expect(formatINR(123456789)).toBe('₹12,34,567.89')
    expect(formatINR(0)).toBe('₹0')
  })
})

describe('parseMoneyInput', () => {
  it('parses typed values', () => {
    expect(parseMoneyInput('1,250.5')).toBe(125050)
    expect(parseMoneyInput('₹ 99')).toBe(9900)
    expect(parseMoneyInput('Rs. 40')).toBe(4000)
    expect(parseMoneyInput('.5')).toBe(50)
    expect(parseMoneyInput('10.')).toBe(1000)
    expect(parseMoneyInput('1.005')).toBe(101)
    expect(parseMoneyInput('1,00,000')).toBe(10000000)
  })
  it('returns null for empty, negative or invalid', () => {
    for (const bad of ['', '   ', '-5', '+5', 'abc', '1.2.3', '12abc', '.']) {
      expect(parseMoneyInput(bad), bad).toBeNull()
    }
  })
})
