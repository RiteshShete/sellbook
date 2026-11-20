import { describe, expect, it } from 'vitest'
import { ProductSchema } from '../../catalog/schemas'
import { parseVoiceOrder } from './parseVoiceOrder'

let n = 0
const hex = () => (++n).toString(16).padStart(12, '0')
const variant = (pid: string, name: string, price: number, grams: number | null) => ({
  id: `00000000-0000-4000-8000-${hex()}`,
  product_id: pid,
  name,
  price,
  cost_price: null,
  size_amount: grams,
  size_unit: grams === null ? null : 'g',
  sort_order: n,
  is_active: true,
  deleted_at: null,
})
const product = (name: string, variants: [string, number, number | null][]) => {
  const id = `11111111-1111-4111-8111-${hex()}`
  return ProductSchema.parse({
    id,
    name,
    sort_order: 0,
    is_active: true,
    variants: variants.map(([vn, price, g]) => variant(id, vn, price, g)),
  })
}

const CATALOG = [
  product('Modak Pith', [['500 g', 250, 500], ['1 kg', 480, 1000]]),
  product('Kanheri', [['Retail', 100, null]]),
  product('Chivda', [['Retail', 90, null]]),
  product('Chakli', [['Retail', 120, null]]),
  product('उपवास भाजणी', [['Retail', 150, null]]),
]

const summary = (text: string) =>
  parseVoiceOrder(text, CATALOG).items.map((i) => `${i.product.name}|${i.variant.name}|${i.quantity}`)

describe('parseVoiceOrder items', () => {
  it('reads quantity after the product, with a spoken size', () => {
    expect(summary('modak pith 500 g 2 kanheri 3')).toEqual(['Modak Pith|500 g|2', 'Kanheri|Retail|3'])
  })

  it('reads quantity before the product when the sentence starts with a number', () => {
    expect(summary('2 modak pith 1 kg 3 kanheri')).toEqual(['Modak Pith|1 kg|2', 'Kanheri|Retail|3'])
  })

  it('understands English, Hindi and Marathi number words and Devanagari digits', () => {
    expect(summary('kanheri two chivda three')).toEqual(['Kanheri|Retail|2', 'Chivda|Retail|3'])
    expect(summary('उपवास भाजणी दोन')).toEqual(['उपवास भाजणी|Retail|2'])
    expect(summary('उपवास भाजणी २')).toEqual(['उपवास भाजणी|Retail|2'])
  })

  it('defaults the quantity to 1 and tolerates one spelling slip on long words', () => {
    expect(summary('chakali')).toEqual(['Chakli|Retail|1'])
  })

  it('does not guess a size: several sizes and none spoken is ambiguous', () => {
    const r = parseVoiceOrder('modak pith 2', CATALOG)
    expect(r.items).toEqual([])
    expect(r.ambiguous).toEqual(['Modak Pith'])
  })
})

describe('parseVoiceOrder customer', () => {
  it('takes the phone (even glued to a quantity) and the leftover name', () => {
    const r = parseVoiceOrder('ravi kanheri 2 98765 43210', CATALOG)
    expect(r.phone).toBe('919876543210')
    expect(r.name).toBe('ravi')
    expect(r.items.map((i) => i.quantity)).toEqual([2])
  })

  it('accepts +91 and Devanagari digits in the phone', () => {
    expect(parseVoiceOrder('kanheri 1 plus 91 98765 43210', CATALOG).phone).toBe('919876543210')
    expect(parseVoiceOrder('kanheri १ ९८७६५ ४३२१०', CATALOG).phone).toBe('919876543210')
  })

  it('ignores a number that is not a valid mobile and reports it as not understood', () => {
    const r = parseVoiceOrder('kanheri 2 12345', CATALOG)
    expect(r.phone).toBeNull()
    expect(r.unmatched).toBe('12345')
  })

  it('gives nothing back for speech that matches nothing', () => {
    const r = parseVoiceOrder('hello there general kenobi good friend', CATALOG)
    expect(r.items).toEqual([])
    expect(r.name).toBeNull()
    expect(r.unmatched).toBe('hello there general kenobi good friend')
  })
})
