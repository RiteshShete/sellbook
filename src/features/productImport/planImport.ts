import { paiseToDecimalString } from '../../lib/money'
import type { SizeUnit } from '../../lib/measure'
import type { Category, Product } from '../catalog/schemas'
import { normKey } from './clean'
import type { ImportRow } from './parseImport'

export type ImportMode = 'add' | 'update'

export interface Catalog {
  products: Product[]
  categories: Category[]
}

export type VariantStatus = 'new' | 'exists' | 'update' | 'error'

export interface VariantDiff {
  price?: [number, number]
  cost?: [number | null, number]
  active?: [boolean, boolean]
}

export interface PlanVariant {
  line: number
  /** The name that will be stored (a blank one becomes the size, or "Variant 2"). */
  name: string
  sizeLabel: string
  pricePaise: number | null
  status: VariantStatus
  /** The AI wrote something in notes: "Flagged by AI, please check". */
  flagged: boolean
  diff?: VariantDiff
  errors: string[]
}

export interface PlanProduct {
  key: string
  name: string
  categoryName: string | null
  /** The product does not exist yet AND at least one of its rows can be imported. */
  willCreate: boolean
  newCategory: boolean
  variants: PlanVariant[]
}

export interface Issue {
  /** The file's own line number; null for a whole-file note. */
  line: number | null
  message: string
}

export interface ApplyVariant {
  name: string
  price: string
  cost_price: string | null
  size_amount: string | null
  size_unit: SizeUnit | null
  is_active: boolean
}

export interface ApplyPayload {
  file_name: string
  mode: ImportMode
  categories: string[]
  products: { name: string; category: string | null; variants: ApplyVariant[] }[]
  add_variants: { product_id: string; variants: ApplyVariant[] }[]
  updates: { variant_id: string; price?: string; cost_price?: string; is_active?: boolean }[]
}

export interface ImportCounts {
  products: number
  variants: number
  categories: number
  updates: number
  skipped: number
  errorRows: number
  warnings: number
}

export interface ImportPlan {
  mode: ImportMode
  products: PlanProduct[]
  errors: Issue[]
  warnings: Issue[]
  skipped: { line: number; reason: string }[]
  counts: ImportCounts
  /** What would be sent to the database; empty parts when nothing changes. */
  payload: ApplyPayload
}

const sizeKey = (amount: string | number | null, unit: string | null) =>
  amount === null ? 'none' : `${Number(amount)}|${unit ?? ''}`

const variantKey = (name: string, amount: string | number | null, unit: string | null) =>
  `${normKey(name)}|${sizeKey(amount, unit)}`

/**
 * Pure: compares the parsed rows with the live catalog and says what an import would do.
 * 'add' never touches an existing price or variant (re-importing a file creates nothing);
 * 'update' also updates price, cost and active of variants matching by product + variant name +
 * size + unit. It never deletes. Rows with errors are reported and left out of the payload.
 */
export function planImport(
  catalog: Catalog,
  rows: ImportRow[],
  mode: ImportMode,
  fileName = '',
  fileWarnings: string[] = [],
): ImportPlan {
  const existingProducts = new Map(catalog.products.map((p) => [normKey(p.name), p]))
  const existingCategories = new Map(catalog.categories.map((c) => [normKey(c.name), c]))
  const categoryById = new Map(catalog.categories.map((c) => [c.id, c.name]))

  const errors: Issue[] = []
  const warnings: Issue[] = fileWarnings.map((message) => ({ line: null, message }))
  const skipped: { line: number; reason: string }[] = []

  // Group rows by product, in file order.
  const groups = new Map<string, ImportRow[]>()
  for (const r of rows) {
    if (r.productName === '') continue
    const k = normKey(r.productName)
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  for (const r of rows) {
    for (const message of r.errors) errors.push({ line: r.line, message })
    for (const message of r.warnings) warnings.push({ line: r.line, message })
    if (r.flagged !== '') {
      warnings.push({ line: r.line, message: `Flagged by AI, please check (${r.flagged})` })
    }
  }

  const products: PlanProduct[] = []
  const payload: ApplyPayload = {
    file_name: fileName,
    mode,
    categories: [],
    products: [],
    add_variants: [],
    updates: [],
  }
  const newCategories = new Map<string, string>()
  const errorLines = new Set(rows.filter((r) => r.errors.length > 0).map((r) => r.line))
  let variantsToCreate = 0

  for (const [key, group] of groups) {
    const first = group[0]
    if (!first) continue
    const existing = existingProducts.get(key)

    const catName = group.map((r) => r.category).find((c) => c !== '') ?? ''
    const catKey = normKey(catName)
    if (group.some((r) => r.category !== '' && normKey(r.category) !== catKey)) {
      warnings.push({
        line: first.line,
        message: `"${first.productName}" lists more than one category; "${catName}" is used.`,
      })
    }

    const liveVariants = new Map(
      (existing?.variants ?? []).map((v) => [variantKey(v.name, v.size_amount, v.size_unit), v]),
    )

    const planVariants: PlanVariant[] = []
    const seenInFile = new Map<string, number>()
    const toCreate: ApplyVariant[] = []
    group.forEach((r, i) => {
      const name = r.variantName !== '' ? r.variantName : r.sizeLabel || `Variant ${i + 1}`
      const base = {
        line: r.line,
        name,
        sizeLabel: r.sizeLabel,
        pricePaise: r.pricePaise,
        flagged: r.flagged !== '',
        errors: r.errors,
      }
      if (r.errors.length > 0 || r.pricePaise === null) {
        planVariants.push({ ...base, status: 'error' })
        return
      }
      // A blank variant name becomes the size, which may equal another row's name: same stored variant.
      const storedKey = variantKey(name, r.sizeAmount, r.sizeUnit)
      const earlier = seenInFile.get(storedKey)
      if (earlier !== undefined) {
        const message = `Same variant name and size as row ${earlier}`
        errors.push({ line: r.line, message })
        planVariants.push({ ...base, status: 'error', errors: [...r.errors, message] })
        errorLines.add(r.line)
        return
      }
      seenInFile.set(storedKey, r.line)
      const match = liveVariants.get(storedKey)
      if (match === undefined) {
        planVariants.push({ ...base, status: 'new' })
        toCreate.push({
          name,
          price: paiseToDecimalString(r.pricePaise),
          cost_price: r.costPaise === null ? null : paiseToDecimalString(r.costPaise),
          size_amount: r.sizeAmount,
          size_unit: r.sizeUnit,
          is_active: r.active ?? true,
        })
        return
      }
      const diff: VariantDiff = {}
      if (mode === 'update') {
        if (match.price !== r.pricePaise) diff.price = [match.price, r.pricePaise]
        if (r.costPaise !== null && match.cost_price !== r.costPaise) {
          diff.cost = [match.cost_price, r.costPaise]
        }
        if (r.active !== null && match.is_active !== r.active) {
          diff.active = [match.is_active, r.active]
        }
      }
      if (Object.keys(diff).length === 0) {
        planVariants.push({ ...base, status: 'exists' })
        skipped.push({ line: r.line, reason: 'Already exists' })
        return
      }
      planVariants.push({ ...base, status: 'update', diff })
      payload.updates.push({
        variant_id: match.id,
        ...(diff.price ? { price: paiseToDecimalString(diff.price[1]) } : {}),
        ...(diff.cost ? { cost_price: paiseToDecimalString(diff.cost[1]) } : {}),
        ...(diff.active ? { is_active: diff.active[1] } : {}),
      })
    })

    if (existing) {
      if (catName !== '' && existing.category_id !== null) {
        const current = categoryById.get(existing.category_id)
        if (current !== undefined && normKey(current) !== catKey) {
          warnings.push({
            line: first.line,
            message: `"${existing.name}" already exists in "${current}"; its category is not changed.`,
          })
        }
      }
      if (toCreate.length > 0)
        payload.add_variants.push({ product_id: existing.id, variants: toCreate })
      variantsToCreate += toCreate.length
      products.push({
        key,
        name: existing.name,
        categoryName: existing.category_id
          ? (categoryById.get(existing.category_id) ?? null)
          : null,
        willCreate: false,
        newCategory: false,
        variants: planVariants,
      })
      continue
    }

    // New product. Created only when at least one row can be imported.
    let categoryName: string | null = null
    let newCategory = false
    if (catName !== '') {
      const known = existingCategories.get(catKey)
      categoryName = known?.name ?? catName
      newCategory = known === undefined
    }
    const willCreate = toCreate.length > 0
    if (willCreate) {
      if (newCategory && !newCategories.has(catKey)) newCategories.set(catKey, catName)
      payload.products.push({ name: first.productName, category: categoryName, variants: toCreate })
      variantsToCreate += toCreate.length
    }
    products.push({
      key,
      name: first.productName,
      categoryName,
      willCreate,
      newCategory: newCategory && willCreate,
      variants: planVariants,
    })
  }

  payload.categories = [...newCategories.values()]
  errors.sort((a, b) => (a.line ?? 0) - (b.line ?? 0))
  warnings.sort((a, b) => (a.line ?? 0) - (b.line ?? 0))

  return {
    mode,
    products,
    errors,
    warnings,
    skipped,
    counts: {
      products: payload.products.length,
      variants: variantsToCreate,
      categories: payload.categories.length,
      updates: payload.updates.length,
      skipped: skipped.length,
      errorRows: errorLines.size,
      warnings: warnings.length,
    },
    payload,
  }
}

/** True when applying the plan would change nothing. */
export function isEmptyPlan(plan: ImportPlan): boolean {
  const c = plan.counts
  return c.products === 0 && c.variants === 0 && c.categories === 0 && c.updates === 0
}

/** Stable text of what would be saved: used to notice that the catalog changed under the review. */
export function planSignature(plan: ImportPlan): string {
  return JSON.stringify({ ...plan.payload, file_name: '' })
}
