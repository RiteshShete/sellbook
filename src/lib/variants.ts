import { formatMeasure, sumLines, type SizeUnit } from './measure'
import { formatINR, type Paise } from './money'

/** The bits of a variant (catalog row or order-item snapshot) that make up its label. */
export interface VariantLabelInput {
  /** May be empty: "Retail", "Wholesale", or just the size ("500 g") for older products. */
  name: string
  size_amount?: number | null
  size_unit?: SizeUnit | null
  /** Shown only when asked for (`includePrice`), e.g. in pickers; order lines show it separately. */
  price?: Paise | null
}

const squash = (s: string) => s.replace(/\s/g, '').toLowerCase()

/** "500 g", "1.25 kg", "6 pcs", or null when the variant has no size. */
export function variantSizeText(
  v: Pick<VariantLabelInput, 'size_amount' | 'size_unit'>,
): string | null {
  return v.size_unit && v.size_amount != null ? formatMeasure(v.size_unit, v.size_amount) : null
}

/**
 * THE variant label, used by cards, pickers, order detail, bills, Delivery and exports:
 * "Retail · 500 g · ₹150". Missing parts are skipped; a name that only repeats the size
 * ("500 g" named "500 g", which older products have) is shown once. Never empty.
 */
export function variantLabel(v: VariantLabelInput, opts: { includePrice?: boolean } = {}): string {
  const size = variantSizeText(v)
  const name = v.name.trim()
  const parts: string[] = []
  if (name && !(size && squash(name) === squash(size))) parts.push(name)
  if (size) parts.push(size)
  if (opts.includePrice && v.price != null) parts.push(formatINR(v.price))
  return parts.length > 0 ? parts.join(' · ') : 'Standard'
}

/** Name used when the owner leaves the variant name empty: the DB requires a non-empty name. */
export function fallbackVariantName(sizeText: string, unit: string, index: number): string {
  const size = sizeText.trim()
  return size ? `${size} ${unit}` : `Variant ${index + 1}`
}

/** Quick picks for the variant name field; the owner can type anything. */
export const VARIANT_NAME_SUGGESTIONS = ['Retail', 'Wholesale', 'Small', 'Medium', 'Large']

export interface WeightSummary {
  /** Total in grams of every line sized in g / kg. */
  grams: number
  /** "6.25 kg" / "750 g", or null when no line has a weight. */
  text: string | null
  /** Units that could not be added to the weight: sized in ml / pcs, or without any size. */
  excludedUnits: number
  /** e.g. "Not counted: 3 items in ml, pcs or without a size", or null when nothing is left out. */
  note: string | null
}

/** Total weight of order lines (quantity x size, g and kg only). ml, l, pcs and unsized are excluded and reported. */
export function weightSummary(
  lines: { quantity: number; size: { unit: SizeUnit; amount: number } | null }[],
): WeightSummary {
  const valid = lines.filter((l) => Number.isSafeInteger(l.quantity) && l.quantity > 0)
  const t = sumLines(valid)
  const excludedUnits = valid
    .filter((l) => l.size?.unit !== 'g')
    .reduce((n, l) => n + l.quantity, 0)
  return {
    grams: t.grams,
    text: t.grams > 0 ? formatMeasure('g', t.grams) : null,
    excludedUnits,
    note:
      excludedUnits > 0
        ? `Not counted: ${excludedUnits} ${excludedUnits === 1 ? 'item' : 'items'} in ml, L, pcs or without a size`
        : null,
  }
}
