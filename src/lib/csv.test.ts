import { describe, expect, it } from 'vitest'
import { BOM, csvField, toCsv } from './csv'

describe('csvField', () => {
  it('leaves plain values alone', () => {
    expect(csvField('Asha')).toBe('Asha')
    expect(csvField(1250.5)).toBe('1250.5')
    expect(csvField(-5)).toBe('-5')
  })
  it('writes empty for null / undefined', () => {
    expect(csvField(null)).toBe('')
    expect(csvField(undefined)).toBe('')
  })
  it('quotes commas, quotes and line breaks (RFC 4180)', () => {
    expect(csvField('Cake, 1 kg')).toBe('"Cake, 1 kg"')
    expect(csvField('Say "hi"')).toBe('"Say ""hi"""')
    expect(csvField('line 1\nline 2')).toBe('"line 1\nline 2"')
  })
  it('defuses text that would run as a formula', () => {
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvField('@cmd')).toBe("'@cmd")
    expect(csvField('-1+2')).toBe("'-1+2")
  })
  it('keeps ₹ as is', () => {
    expect(csvField('Total (₹)')).toBe('Total (₹)')
  })
})

describe('toCsv', () => {
  it('starts with a BOM and uses CRLF line ends', () => {
    const csv = toCsv([
      ['Name', 'Total (₹)'],
      ['Asha, R', 900],
    ])
    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv.slice(BOM.length)).toBe('Name,Total (₹)\r\n"Asha, R",900\r\n')
  })
})
