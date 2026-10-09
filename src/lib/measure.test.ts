import { describe, expect, it } from 'vitest'
import { formatMeasure, formatTotals, parseSizeInput, sizeToInput, sumLines } from './measure'

describe('formatMeasure', () => {
  it('switches to kg / L from 1000', () => {
    expect(formatMeasure('g', 750)).toBe('750 g')
    expect(formatMeasure('g', 1000)).toBe('1 kg')
    expect(formatMeasure('g', 6250)).toBe('6.25 kg')
    expect(formatMeasure('g', 1250500)).toBe('1,250.5 kg')
    expect(formatMeasure('ml', 500)).toBe('500 ml')
    expect(formatMeasure('ml', 1500)).toBe('1.5 L')
    expect(formatMeasure('pcs', 12)).toBe('12 pcs')
  })
})

describe('formatTotals', () => {
  it('lists each unit that is present, unsized lines as items', () => {
    expect(formatTotals({ grams: 6250, ml: 0, pieces: 0, unsized: 0 })).toEqual(['6.25 kg'])
    expect(formatTotals({ grams: 2750, ml: 1000, pieces: 6, unsized: 1 })).toEqual([
      '2.75 kg',
      '1 L',
      '6 pcs',
      '1 item',
    ])
    expect(formatTotals({ grams: 0, ml: 0, pieces: 0, unsized: 4 })).toEqual(['4 items'])
    expect(formatTotals({ grams: 0, ml: 0, pieces: 0, unsized: 0 })).toEqual([])
  })
})

describe('parseSizeInput', () => {
  const size = (text: string, unit: Parameters<typeof parseSizeInput>[1]) => {
    const r = parseSizeInput(text, unit)
    return r.ok ? r.size : r.error
  }
  it('stores base units exactly', () => {
    expect(size('250', 'g')).toEqual({ size_amount: '250', size_unit: 'g' })
    expect(size('1', 'kg')).toEqual({ size_amount: '1000', size_unit: 'g' })
    expect(size('1.25', 'kg')).toEqual({ size_amount: '1250', size_unit: 'g' })
    expect(size('0.333', 'kg')).toEqual({ size_amount: '333', size_unit: 'g' })
    expect(size('1.5', 'L')).toEqual({ size_amount: '1500', size_unit: 'ml' })
    expect(size('500', 'ml')).toEqual({ size_amount: '500', size_unit: 'ml' })
    expect(size('6', 'pcs')).toEqual({ size_amount: '6', size_unit: 'pcs' })
    expect(size('2.5', 'g')).toEqual({ size_amount: '2.5', size_unit: 'g' })
    expect(size('1,000', 'g')).toEqual({ size_amount: '1000', size_unit: 'g' })
  })
  it('treats empty as no size', () => {
    expect(size('  ', 'kg')).toBeNull()
  })
  it('rejects bad input', () => {
    expect(size('abc', 'g')).toBe('Up to 3 decimals')
    expect(size('1.2345', 'kg')).toBe('Up to 3 decimals')
    expect(size('-1', 'g')).toBe('Up to 3 decimals')
    expect(size('0', 'g')).toBe('Must be more than 0')
  })
})

describe('sizeToInput', () => {
  it('shows big amounts in kg / L', () => {
    expect(sizeToInput('g', 1000)).toEqual({ text: '1', unit: 'kg' })
    expect(sizeToInput('g', 1250)).toEqual({ text: '1.25', unit: 'kg' })
    expect(sizeToInput('g', 250)).toEqual({ text: '250', unit: 'g' })
    expect(sizeToInput('ml', 2000)).toEqual({ text: '2', unit: 'L' })
    expect(sizeToInput('pcs', 6)).toEqual({ text: '6', unit: 'pcs' })
  })
  it('round-trips through parseSizeInput', () => {
    for (const [unit, amount] of [
      ['g', 1250],
      ['g', 333],
      ['ml', 1500],
      ['pcs', 12],
    ] as const) {
      const input = sizeToInput(unit, amount)
      const back = parseSizeInput(input.text, input.unit)
      expect(back.ok && back.size).toEqual({ size_amount: String(amount), size_unit: unit })
    }
  })
  it('is empty with no size', () => {
    expect(sizeToInput(null, null)).toEqual({ text: '', unit: 'g' })
  })
})

describe('sumLines', () => {
  it('adds quantity x size per unit without float drift', () => {
    expect(
      sumLines([
        { quantity: 3, size: { unit: 'g', amount: 333.333 } },
        { quantity: 2, size: { unit: 'g', amount: 1000 } },
        { quantity: 1, size: { unit: 'ml', amount: 500 } },
        { quantity: 4, size: null },
      ]),
    ).toEqual({ grams: 2999.999, ml: 500, pieces: 0, unsized: 4 })
  })
})
