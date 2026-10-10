import { z } from 'zod'
import { fromPaise, paiseToDecimalString, parseMoneyInput, type Paise } from '../../lib/money'
import {
  SizeUnitSchema,
  dbAmount,
  parseSizeInput,
  sizeToInput,
  type InputUnit,
  type SizeUnit,
} from '../../lib/measure'
import { fallbackVariantName } from '../../lib/variants'
import { dbMoney, dbMoneyNullable } from '../../lib/zodMoney'

// ---- Rows from the database (prices -> integer paise) ------------------------------------------

export const VariantSchema = z.object({
  id: z.guid(),
  product_id: z.guid(),
  name: z.string(),
  price: dbMoney,
  cost_price: dbMoneyNullable,
  /** Size in base units (g / ml / pcs), or both null. */
  size_amount: dbAmount.nullable(),
  size_unit: SizeUnitSchema.nullable(),
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
  /** Size as typed, e.g. "1.25" with unit "kg"; empty = no size. */
  sizeText: string
  sizeUnit: InputUnit
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
    /** Always sent, so clearing a size in the editor clears it in the database. */
    size_amount: string | null
    size_unit: SizeUnit | null
    is_active: boolean
  }[]
}

export interface VariantErrors {
  name?: string
  price?: string
  cost?: string
  size?: string
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
    variants: p.variants.map((v) => {
      const size = sizeToInput(v.size_unit, v.size_amount)
      return {
        key: v.id,
        id: v.id,
        name: v.name,
        price: paiseText(v.price),
        cost: v.cost_price === null ? '' : paiseText(v.cost_price),
        sizeText: size.text,
        sizeUnit: size.unit,
        is_active: v.is_active,
      }
    }),
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
  for (const [index, v] of draft.variants.entries()) {
    const e: VariantErrors = {}
    // The name is optional (a size alone is enough); the database needs one, so a blank name
    // becomes "500 g" / "Variant 2". variantLabel() shows it once, never twice.
    const vName = v.name.trim() || fallbackVariantName(v.sizeText, v.sizeUnit, index)
    if (vName.length > 80) e.name = 'Too long'

    const price = parseMoneyInput(v.price)
    if (price === null) e.price = 'Enter a price'

    const cost = v.cost.trim() === '' ? null : parseMoneyInput(v.cost)
    if (v.cost.trim() !== '' && cost === null) e.cost = 'Invalid amount'

    const size = parseSizeInput(v.sizeText, v.sizeUnit)
    if (!size.ok) e.size = size.error
    else {
      // Same name AND same size twice in one product is a duplicate (the same name with another size is fine).
      const id = `${vName.toLowerCase()}|${size.size?.size_amount ?? ''}|${size.size?.size_unit ?? ''}`
      if (seen.has(id)) e.name = 'Same name and size already listed'
      seen.add(id)
    }

    if (e.name || e.price || e.cost || e.size) errors.byVariant[v.key] = e
    else if (price !== null && size.ok) {
      variants.push({
        ...(v.id ? { id: v.id } : {}),
        name: vName,
        price: paiseToDecimalString(price),
        cost_price: cost === null ? null : paiseToDecimalString(cost),
        size_amount: size.size?.size_amount ?? null,
        size_unit: size.size?.size_unit ?? null,
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
