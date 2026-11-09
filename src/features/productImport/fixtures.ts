import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Category, Product, Variant } from '../catalog/schemas'

/** Test-only helpers: read a CSV fixture and build fake catalogs. Never touches real products. */
const DIR = resolve(__dirname, '../../../tests/fixtures/product-import')

export const fixtureBytes = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(resolve(DIR, name)))

export const fixtureText = (name: string): string =>
  new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(fixtureBytes(name))

let n = 0
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`

export function variant(over: Partial<Variant> & { name: string; price: number }): Variant {
  return {
    id: id(),
    product_id: '',
    cost_price: null,
    size_amount: null,
    size_unit: null,
    sort_order: 0,
    is_active: true,
    deleted_at: null,
    ...over,
  }
}

export function product(
  name: string,
  variants: Variant[],
  category_id: string | null = null,
): Product {
  const pid = id()
  return {
    id: pid,
    name,
    sort_order: 0,
    is_active: true,
    category_id,
    variants: variants.map((v) => ({ ...v, product_id: pid })),
  }
}

export const category = (name: string): Category => ({ id: id(), name, sort_order: 0 })
