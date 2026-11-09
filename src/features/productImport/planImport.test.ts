import { describe, expect, it } from 'vitest'
import { fromPaise } from '../../lib/money'
import type { Category, Product } from '../catalog/schemas'
import { category, fixtureText, product, variant } from './fixtures'
import { parseImportText, type ImportRow } from './parseImport'
import {
  isEmptyPlan,
  planImport,
  planSignature,
  type ApplyPayload,
  type Catalog,
} from './planImport'

function rows(csv: string): ImportRow[] {
  const out = parseImportText(csv)
  if (!out.ok) throw new Error(out.message)
  return out.rows
}

const EMPTY: Catalog = { products: [], categories: [] }

/** Applies a payload the way apply_product_import does, so re-planning can prove idempotency. */
function simulateApply(catalog: Catalog, p: ApplyPayload): Catalog {
  const categories: Category[] = [...catalog.categories]
  for (const name of p.categories) {
    if (!categories.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      categories.push(category(name))
  }
  const toVariant = (v: ApplyPayload['products'][number]['variants'][number]) =>
    variant({
      name: v.name,
      price: Math.round(Number(v.price) * 100),
      cost_price: v.cost_price === null ? null : Math.round(Number(v.cost_price) * 100),
      size_amount: v.size_amount === null ? null : Number(v.size_amount),
      size_unit: v.size_unit,
      is_active: v.is_active,
    })
  const products: Product[] = catalog.products.map((pr) => ({ ...pr, variants: [...pr.variants] }))
  for (const np of p.products) {
    const cat = categories.find((c) => c.name === np.category)
    products.push(product(np.name, np.variants.map(toVariant), cat?.id ?? null))
  }
  for (const a of p.add_variants) {
    const pr = products.find((x) => x.id === a.product_id)
    pr?.variants.push(...a.variants.map((v) => ({ ...toVariant(v), product_id: a.product_id })))
  }
  for (const u of p.updates) {
    for (const pr of products) {
      pr.variants = pr.variants.map((v) =>
        v.id !== u.variant_id
          ? v
          : {
              ...v,
              ...(u.price !== undefined ? { price: Math.round(Number(u.price) * 100) } : {}),
              ...(u.cost_price !== undefined
                ? { cost_price: Math.round(Number(u.cost_price) * 100) }
                : {}),
              ...(u.is_active !== undefined ? { is_active: u.is_active } : {}),
            },
      )
    }
  }
  return { products, categories }
}

const GOOD = () => rows(fixtureText('good.csv'))

describe("planImport, 'Add new only'", () => {
  it('creates products, variants and categories on an empty catalog', () => {
    const plan = planImport(EMPTY, GOOD(), 'add', 'good.csv')
    expect(plan.counts).toMatchObject({
      products: 3,
      variants: 5,
      categories: 3,
      updates: 0,
      skipped: 0,
      errorRows: 0,
    })
    expect(plan.payload.categories).toEqual(['Breakfast', 'Tea', 'Drinks'])
    expect(plan.payload.products.map((p) => [p.name, p.variants.length])).toEqual([
      ['Poha', 2],
      ['Chai Masala', 2],
      ['Sharbat', 1],
    ])
    expect(plan.payload.products[2]?.variants[0]).toMatchObject({
      price: '140.00',
      size_amount: '750',
      size_unit: 'ml',
      is_active: false,
    })
  })

  it('is idempotent: importing the same file twice creates nothing the second time', () => {
    const first = planImport(EMPTY, GOOD(), 'add')
    const after = simulateApply(EMPTY, first.payload)
    const second = planImport(after, GOOD(), 'add')
    expect(isEmptyPlan(second)).toBe(true)
    expect(second.counts.skipped).toBe(5)
    expect(second.skipped.every((s) => s.reason === 'Already exists')).toBe(true)
  })

  it('adds a new variant to an existing product and never changes an existing price', () => {
    const existing = product('poha', [
      variant({ name: '500 g', price: 5000, size_amount: 500, size_unit: 'g' }),
    ])
    const plan = planImport({ products: [existing], categories: [] }, GOOD(), 'add')
    expect(plan.payload.updates).toEqual([])
    expect(plan.payload.add_variants).toEqual([
      {
        product_id: existing.id,
        variants: [expect.objectContaining({ name: '1 kg', price: '115.00' })],
      },
    ])
    const poha = plan.products.find((p) => p.name === 'poha')
    expect(poha?.variants.map((v) => v.status)).toEqual(['exists', 'new'])
    expect(plan.payload.products.map((p) => p.name)).not.toContain('Poha')
  })

  it('reuses an existing category by normalised name and creates only the missing ones', () => {
    const tea = category('TEA')
    const plan = planImport({ products: [], categories: [tea] }, GOOD(), 'add')
    expect(plan.payload.categories).toEqual(['Breakfast', 'Drinks'])
    expect(plan.payload.products.find((p) => p.name === 'Chai Masala')?.category).toBe('TEA')
  })

  it('names a blank variant from its size, or "Variant N" with no size', () => {
    const plan = planImport(EMPTY, rows('product_name,size,unit,price\nA,500,g,1\nB,,,2\n'), 'add')
    expect(plan.products.map((p) => p.variants[0]?.name)).toEqual(['500 g', 'Variant 1'])
  })

  it('two rows that end up with the same stored name and size: the second is an error', () => {
    const plan = planImport(
      EMPTY,
      rows('product_name,variant_name,size,unit,price\nA,,500,g,1\nA,500 g,500,g,2\n'),
      'add',
    )
    expect(plan.counts.errorRows).toBe(1)
    expect(plan.errors[0]).toMatchObject({ line: 3 })
    expect(plan.payload.products[0]?.variants).toHaveLength(1)
  })
})

describe("planImport, 'Add and update prices'", () => {
  const existing = () =>
    product('Poha', [
      variant({ name: '500 g', price: 5000, size_amount: 500, size_unit: 'g', cost_price: 4000 }),
      variant({ name: '1 kg', price: 11500, size_amount: 1000, size_unit: 'g' }),
    ])

  it('updates price, cost and active only where they differ, with before and after', () => {
    const csv =
      'product_name,variant_name,size,unit,price,cost_price,active\nPoha,,500,g,60,45,no\nPoha,,1,kg,115,,\n'
    const plan = planImport({ products: [existing()], categories: [] }, rows(csv), 'update')
    expect(plan.counts).toMatchObject({ updates: 1, skipped: 1, variants: 0 })
    const v = plan.products[0]?.variants[0]
    expect(v?.status).toBe('update')
    expect(v?.diff).toEqual({ price: [5000, 6000], cost: [4000, 4500], active: [true, false] })
    expect(plan.payload.updates[0]).toMatchObject({
      price: '60.00',
      cost_price: '45.00',
      is_active: false,
    })
    expect(fromPaise(v?.diff?.price?.[1] ?? 0)).toBe(60)
  })

  it('a blank cost or active leaves the stored value alone', () => {
    const plan = planImport(
      { products: [existing()], categories: [] },
      rows('product_name,size,unit,price\nPoha,500,g,60\n'),
      'update',
    )
    expect(plan.payload.updates[0]).toEqual({ variant_id: expect.any(String), price: '60.00' })
  })

  it('is idempotent after applying', () => {
    const catalog: Catalog = { products: [existing()], categories: [] }
    const csv = rows('product_name,size,unit,price\nPoha,500,g,60\n')
    const after = simulateApply(catalog, planImport(catalog, csv, 'update').payload)
    expect(isEmptyPlan(planImport(after, csv, 'update'))).toBe(true)
  })

  it("'add' mode never produces updates for the same file", () => {
    const plan = planImport(
      { products: [existing()], categories: [] },
      rows('product_name,size,unit,price\nPoha,500,g,60\n'),
      'add',
    )
    expect(plan.payload.updates).toEqual([])
    expect(plan.counts.skipped).toBe(1)
  })
})

describe('errors, warnings, signature', () => {
  it('errors affect only their own rows; a product with no importable row is not created', () => {
    const plan = planImport(EMPTY, rows(fixtureText('invalid-unit.csv')), 'add')
    expect(plan.counts).toMatchObject({ products: 1, variants: 1, errorRows: 1 })
    expect(plan.payload.products.map((p) => p.name)).toEqual(['Rice'])
    expect(plan.products.find((p) => p.name === 'Poha')?.willCreate).toBe(false)
    expect(plan.errors[0]).toMatchObject({ line: 2 })
  })

  it('flagged notes and cleaned values become warnings with row numbers', () => {
    const plan = planImport(EMPTY, rows('product_name,price,notes\nA,Rs. 5,CHECK\n'), 'add', '', [
      'Unknown column "x" is ignored.',
    ])
    expect(plan.warnings.map((w) => [w.line, w.message.split(' ')[0]])).toEqual([
      [null, 'Unknown'],
      [2, 'Price'],
      [2, 'Flagged'],
    ])
    expect(plan.products[0]?.variants[0]?.flagged).toBe(true)
  })

  it('the signature changes when the catalog changes under a review', () => {
    const csv = rows('product_name,price\nA,5\n')
    const a = planSignature(planImport(EMPTY, csv, 'add'))
    const b = planSignature(
      planImport(
        { products: [product('A', [variant({ name: 'Variant 1', price: 500 })])], categories: [] },
        csv,
        'add',
      ),
    )
    expect(a).not.toBe(b)
    expect(a).toBe(planSignature(planImport(EMPTY, csv, 'add', 'other-name.csv')))
  })
})
