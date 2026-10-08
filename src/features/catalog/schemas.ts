import { z } from 'zod'
import { fromPaise, paiseToDecimalString, parseMoneyInput, type Paise } from '../../lib/money'
import { dbMoney, dbMoneyNullable } from '../../lib/zodMoney'

// ---- Rows from the database (prices -> integer paise) ------------------------------------------

export const VariantSchema = z.object({
  id: z.guid(),
  product_id: z.guid(),
  name: z.string(),
  price: dbMoney,
  cost_price: dbMoneyNullable,
  sort_order: z.number().int(),
  is_active: z.boolean(),
  deleted_at: z.string().nullable(),
})
export type Variant = z.infer<typeof VariantSchema>

/** Product with its live (not trashed) variants, in display order. */
export const ProductSchema = z
  .object({
    id: z.guid(),
    name: z.string(),
    sort_order: z.number().int(),
    is_active: z.boolean(),
    variants: z.array(VariantSchema),
  })
  .transform((p) => ({
    ...p,
    variants: p.variants
      .filter((v) => v.deleted_at === null)
      .sort((a, b) => a.sort_order - b.sort_order),
  }))
export type Product = z.infer<typeof ProductSchema>

export const UpsertResultSchema = z.object({ id: z.guid() })

// ---- Editor form ---------------------------------------------------------------------------------

export interface VariantDraft {
  /** Stable React key; equals id for saved variants. */
  key: string
  id?: string
  name: string
  price: string
  cost: string
  is_active: boolean
}

export interface ProductDraft {
  name: string
  is_active: boolean
  variants: VariantDraft[]
}

export interface UpsertProductPayload {
  id?: string
  name: string
  is_active: boolean
  variants: {
    id?: string
    name: string
    price: string
    cost_price: string | null
    is_active: boolean
  }[]
}

export interface VariantErrors {
  name?: string
  price?: string
  cost?: string
}

export interface ProductErrors {
  name?: string
  variants?: string
  byVariant: Record<string, VariantErrors>
}

export type ProductValidation =
  { ok: true; payload: UpsertProductPayload } | { ok: false; errors: ProductErrors }

const paiseText = (p: Paise) => String(fromPaise(p))

export function draftFromProduct(p: Product): ProductDraft {
  return {
    name: p.name,
    is_active: p.is_active,
    variants: p.variants.map((v) => ({
      key: v.id,
      id: v.id,
      name: v.name,
      price: paiseText(v.price),
      cost: v.cost_price === null ? '' : paiseText(v.cost_price),
      is_active: v.is_active,
    })),
  }
}

/** Validates the editor and builds the upsert_product payload (money as exact decimal strings). */
export function validateProductDraft(draft: ProductDraft, id?: string): ProductValidation {
  const errors: ProductErrors = { byVariant: {} }
  const name = draft.name.trim()
  if (!name) errors.name = 'Enter a product name'
  else if (name.length > 80) errors.name = 'Keep it under 80 characters'

  if (draft.variants.length === 0) errors.variants = 'Add at least one variant'

  const seen = new Set<string>()
  const variants: UpsertProductPayload['variants'] = []
  for (const v of draft.variants) {
    const e: VariantErrors = {}
    const vName = v.name.trim()
    if (!vName) e.name = 'Name needed'
    else if (vName.length > 80) e.name = 'Too long'
    else if (seen.has(vName.toLowerCase())) e.name = 'Duplicate name'
    seen.add(vName.toLowerCase())

    const price = parseMoneyInput(v.price)
    if (price === null) e.price = 'Enter a price'

    const cost = v.cost.trim() === '' ? null : parseMoneyInput(v.cost)
    if (v.cost.trim() !== '' && cost === null) e.cost = 'Invalid amount'

    if (e.name || e.price || e.cost) errors.byVariant[v.key] = e
    else if (price !== null) {
      variants.push({
        ...(v.id ? { id: v.id } : {}),
        name: vName,
        price: paiseToDecimalString(price),
        cost_price: cost === null ? null : paiseToDecimalString(cost),
        is_active: v.is_active,
      })
    }
  }

  if (errors.name || errors.variants || Object.keys(errors.byVariant).length > 0) {
    return { ok: false, errors }
  }
  return {
    ok: true,
    payload: { ...(id ? { id } : {}), name, is_active: draft.is_active, variants },
  }
}
