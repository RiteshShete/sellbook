import { describe, expect, it } from 'vitest'
import {
  cleanSize,
  cleanText,
  devanagariDigits,
  mapUnit,
  normKey,
  parseActive,
  parseRupees,
} from './clean'

describe('cleanText', () => {
  it('trims, collapses spaces, removes control characters, NFC-normalises', () => {
    expect(cleanText('  Poha \t  Mix\n\u0007 ')).toBe('Poha Mix')
    expect(cleanText('é')).toBe('é')
  })
  it('keeps zero-width joiners in the stored text', () => {
    expect(cleanText('क्\u200Dष')).toBe('क्\u200Dष')
  })
})

describe('normKey', () => {
  it('ignores case, spaces and joiners in the KEY only', () => {
    expect(normKey(' POHA  ')).toBe(normKey('poha'))
    expect(normKey('क्\u200Dष')).toBe(normKey('क्ष'))
    expect(cleanText('क्\u200Dष')).not.toBe('क्ष')
  })
})

describe('devanagariDigits', () => {
  it('converts ०-९', () => expect(devanagariDigits('१२०.५०')).toBe('120.50'))
})

describe('parseRupees', () => {
  const paise = (s: string) => {
    const r = parseRupees(s, 'Price')
    return r.ok ? r.paise : r.error
  }
  it('parses plain and Devanagari numbers', () => {
    expect(paise('120')).toBe(12000)
    expect(paise('१२०')).toBe(12000)
    expect(paise('0')).toBe(0)
  })
  it('strips Rs, Rs., INR, the rupee sign, commas and /- with a cleaned warning', () => {
    for (const s of ['₹1,250.50', 'Rs. 1250.5', 'rs1,250.50', 'INR 1250.50', '1,250.50/-']) {
      const r = parseRupees(s, 'Price')
      expect(r).toMatchObject({ ok: true, paise: 125050 })
      expect(r.ok && r.warnings.join()).toContain('cleaned')
    }
  })
  it('rounds to 2 decimals half-up and says so', () => {
    expect(parseRupees('12.345', 'Price')).toMatchObject({ ok: true, paise: 1235 })
    expect(parseRupees('12.344', 'Price')).toMatchObject({ ok: true, paise: 1234 })
    const r = parseRupees('12.345', 'Price')
    expect(r.ok && r.warnings.join()).toContain('rounded')
  })
  it('rejects blank, text, negative and over 1,000,000', () => {
    expect(paise('')).toContain('missing')
    expect(paise('abc')).toContain('not a number')
    expect(paise('-5')).toContain('not a number')
    expect(paise('1000000')).toBe(100000000)
    expect(paise('1000000.01')).toContain('between 0 and 1,000,000')
  })
})

describe('mapUnit', () => {
  it('maps synonyms and safe Marathi words', () => {
    expect(mapUnit('Gms')).toBe('g')
    expect(mapUnit('grams')).toBe('g')
    expect(mapUnit('kilo')).toBe('kg')
    expect(mapUnit('kgs')).toBe('kg')
    expect(mapUnit('Nos')).toBe('pcs')
    expect(mapUnit('pieces')).toBe('pcs')
    expect(mapUnit('ltr')).toBe('l')
    expect(mapUnit('Litre')).toBe('l')
    expect(mapUnit('ग्रॅम')).toBe('g')
    expect(mapUnit('किलो')).toBe('kg')
    expect(mapUnit('नग')).toBe('pcs')
    expect(mapUnit('लिटर')).toBe('l')
  })
  it('returns null for unknown words', () => expect(mapUnit('stone')).toBeNull())
})

describe('cleanSize / parseActive', () => {
  it('sizes are plain decimals; a comma decimal is rejected, not guessed', () => {
    expect(cleanSize('१.५')).toBe('1.5')
    expect(cleanSize('1,5')).toBeNull()
    expect(cleanSize('abc')).toBeNull()
  })
  it('active accepts yes/no/true/false/1/0, blank is null, junk is undefined', () => {
    expect(parseActive('Yes')).toBe(true)
    expect(parseActive('0')).toBe(false)
    expect(parseActive('')).toBeNull()
    expect(parseActive('maybe')).toBeUndefined()
  })
})
