import { describe, expect, it } from 'vitest'
import { toPaise } from './money'
import { fallbackVariantName, variantLabel, variantSizeText, weightSummary } from './variants'

describe('variantLabel', () => {
  it('joins name, size and price', () => {
    expect(
      variantLabel(
        { name: 'Retail', size_amount: 500, size_unit: 'g', price: toPaise(150) },
        { includePrice: true },
      ),
    ).toBe('Retail · 500 g · ₹150')
  })

  it('handles a missing name (older products)', () => {
    expect(
      variantLabel(
        { name: '', size_amount: 500, size_unit: 'g', price: toPaise(60) },
        { includePrice: true },
      ),
    ).toBe('500 g · ₹60')
  })

  it('does not repeat a size already used as the name', () => {
    expect(variantLabel({ name: '500 g', size_amount: 500, size_unit: 'g' })).toBe('500 g')
    expect(variantLabel({ name: '1kg', size_amount: 1000, size_unit: 'g' })).toBe('1 kg')
  })

  it('omits the price unless asked, and skips a missing size', () => {
    const v = { name: 'Wholesale', price: toPaise(1200) }
    expect(variantLabel(v)).toBe('Wholesale')
    expect(variantLabel(v, { includePrice: true })).toBe('Wholesale · ₹1,200')
  })

  it('never returns an empty string', () => {
    expect(variantLabel({ name: '  ' })).toBe('Standard')
  })

  it('renders Devanagari names untouched', () => {
    expect(variantLabel({ name: 'किरकोळ', size_amount: 250, size_unit: 'g' })).toBe(
      'किरकोळ · 250 g',
    )
  })

  it('formats ml and pcs sizes', () => {
    expect(variantSizeText({ size_amount: 1500, size_unit: 'ml' })).toBe('1.5 L')
    expect(variantSizeText({ size_amount: 6, size_unit: 'pcs' })).toBe('6 pcs')
    expect(variantSizeText({ size_amount: null, size_unit: null })).toBeNull()
  })
})

describe('fallbackVariantName', () => {
  it('uses the typed size, else a numbered name', () => {
    expect(fallbackVariantName('500', 'g', 0)).toBe('500 g')
    expect(fallbackVariantName('', 'g', 1)).toBe('Variant 2')
  })
})

describe('weightSummary', () => {
  it('sums quantity x size in grams and shows kg', () => {
    const w = weightSummary([
      { quantity: 3, size: { unit: 'g', amount: 500 } },
      { quantity: 2, size: { unit: 'g', amount: 1000 } },
    ])
    expect(w.grams).toBe(3500)
    expect(w.text).toBe('3.5 kg')
    expect(w.note).toBeNull()
  })

  it('shows grams below 1 kg', () => {
    expect(weightSummary([{ quantity: 3, size: { unit: 'g', amount: 250 } }]).text).toBe('750 g')
  })

  it('excludes pcs, ml and unsized lines and says so', () => {
    const w = weightSummary([
      { quantity: 1, size: { unit: 'g', amount: 500 } },
      { quantity: 4, size: { unit: 'pcs', amount: 6 } },
      { quantity: 2, size: { unit: 'ml', amount: 500 } },
      { quantity: 1, size: null },
    ])
    expect(w.text).toBe('500 g')
    expect(w.excludedUnits).toBe(7)
    expect(w.note).toBe('Not counted: 7 items in ml, L, pcs or without a size')
  })

  it('has no weight when nothing is in grams', () => {
    const w = weightSummary([{ quantity: 1, size: { unit: 'pcs', amount: 6 } }])
    expect(w.text).toBeNull()
    expect(w.note).toBe('Not counted: 1 item in ml, L, pcs or without a size')
  })

  it('ignores half-typed quantities', () => {
    expect(
      weightSummary([{ quantity: Number.NaN, size: { unit: 'g', amount: 500 } }]).text,
    ).toBeNull()
  })
})
