import { describe, expect, it } from 'vitest'
import { ProductSchema, draftFromProduct, validateProductDraft, type ProductDraft } from './schemas'

const P = '11111111-1111-1111-1111-111111111111'
const V1 = '22222222-2222-2222-2222-222222222222'
const V2 = '33333333-3333-3333-3333-333333333333'
const V3 = '44444444-4444-4444-4444-444444444444'

const row = {
  id: P,
  name: 'Cake',
  sort_order: 0,
  is_active: true,
  variants: [
    {
      id: V2,
      product_id: P,
      name: '1 kg',
      price: 480.5,
      cost_price: '300.00',
      size_amount: '1000.000',
      size_unit: 'g',
      sort_order: 1,
      is_active: true,
      deleted_at: null,
    },
    {
      id: V1,
      product_id: P,
      name: '500 g',
      price: '250',
      cost_price: null,
      size_amount: 500,
      size_unit: 'g',
      sort_order: 0,
      is_active: false,
      deleted_at: null,
    },
    {
      id: V3,
      product_id: P,
      name: 'Old',
      price: 1,
      cost_price: null,
      size_amount: null,
      size_unit: null,
      sort_order: 2,
      is_active: true,
      deleted_at: '2026-10-01T00:00:00Z',
    },
  ],
}

describe('ProductSchema', () => {
  it('converts DB numerics (number or string) to paise, drops trashed variants, sorts', () => {
    const p = ProductSchema.parse(row)
    expect(p.variants.map((v) => v.name)).toEqual(['500 g', '1 kg'])
    expect(p.variants.map((v) => v.price)).toEqual([25000, 48050])
    expect(p.variants.map((v) => v.cost_price)).toEqual([null, 30000])
  })

  it('rejects a malformed row', () => {
    expect(() => ProductSchema.parse({ ...row, is_active: 'yes' })).toThrow()
  })
})

describe('draftFromProduct', () => {
  it('shows prices as plain rupee text and blank optional cost', () => {
    const d = draftFromProduct(ProductSchema.parse(row))
    expect(d.variants[0]).toMatchObject({
      key: V1,
      id: V1,
      price: '250',
      cost: '',
      is_active: false,
    })
    expect(d.variants[1]).toMatchObject({
      price: '480.5',
      cost: '300',
      sizeText: '1',
      sizeUnit: 'kg',
    })
    expect(d.variants[0]).toMatchObject({ sizeText: '500', sizeUnit: 'g' })
  })
})

describe('validateProductDraft', () => {
  const draft = (over: Partial<ProductDraft> = {}): ProductDraft => ({
    name: ' Cake ',
    is_active: true,
    variants: [
      {
        key: 'a',
        id: V1,
        name: ' 500 g ',
        price: '₹1,250.5',
        cost: '',
        sizeText: '500',
        sizeUnit: 'g',
        is_active: true,
      },
      {
        key: 'b',
        name: '1 kg',
        price: '480',
        cost: '300.25',
        sizeText: '',
        sizeUnit: 'g',
        is_active: false,
      },
    ],
    ...over,
  })

  it('builds the RPC payload with exact decimal strings', () => {
    const r = validateProductDraft(draft(), P)
    expect(r).toEqual({
      ok: true,
      payload: {
        id: P,
        name: 'Cake',
        is_active: true,
        variants: [
          {
            id: V1,
            name: '500 g',
            price: '1250.50',
            cost_price: null,
            size_amount: '500',
            size_unit: 'g',
            is_active: true,
          },
          {
            name: '1 kg',
            price: '480.00',
            cost_price: '300.25',
            size_amount: null,
            size_unit: null,
            is_active: false,
          },
        ],
      },
    })
  })

  it('omits id for a new product', () => {
    const r = validateProductDraft(draft())
    expect(r.ok && 'id' in r.payload).toBe(false)
  })

  it('requires a name and at least one variant', () => {
    const r = validateProductDraft(draft({ name: '  ', variants: [] }))
    expect(r).toEqual({
      ok: false,
      errors: { name: 'Enter a product name', variants: 'Add at least one variant', byVariant: {} },
    })
  })

  it('flags per-variant problems by key, including case-insensitive duplicates', () => {
    const r = validateProductDraft(
      draft({
        variants: [
          {
            key: 'a',
            name: 'Small',
            price: 'abc',
            cost: '',
            sizeText: '',
            sizeUnit: 'g',
            is_active: true,
          },
          {
            key: 'b',
            name: 'small',
            price: '10',
            cost: '-5',
            sizeText: '1.2345',
            sizeUnit: 'kg',
            is_active: true,
          },
        ],
      }),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.byVariant.a).toEqual({ price: 'Enter a price' })
      expect(r.errors.byVariant.b).toEqual({ cost: 'Invalid amount', size: 'Up to 3 decimals' })
    }
  })

  const v = (key: string, name: string, sizeText: string, sizeUnit: 'g' | 'kg' = 'g') => ({
    key,
    name,
    price: '10',
    cost: '',
    sizeText,
    sizeUnit,
    is_active: true,
  })

  it('allows the same name with different sizes, rejects the same name and size', () => {
    const ok = validateProductDraft(
      draft({ variants: [v('a', 'Retail', '500'), v('b', 'retail', '1', 'kg')] }),
    )
    expect(ok.ok).toBe(true)
    const dup = validateProductDraft(
      draft({ variants: [v('a', 'Retail', '1', 'kg'), v('b', 'RETAIL', '1000')] }),
    )
    expect(dup.ok).toBe(false)
    if (!dup.ok) expect(dup.errors.byVariant.b?.name).toBe('Same name and size already listed')
  })

  it('makes the name optional: a blank name becomes the size, or "Variant N"', () => {
    const r = validateProductDraft(draft({ variants: [v('a', '', '500'), v('b', '', '')] }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.payload.variants.map((x) => x.name)).toEqual(['500 g', 'Variant 2'])
  })

  it('rejects a size of zero or less', () => {
    const r = validateProductDraft(draft({ variants: [v('a', 'Retail', '0')] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.byVariant.a?.size).toBe('Must be more than 0')
  })
})
