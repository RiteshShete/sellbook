import { z } from 'zod'
import { pluralize } from './format'

/**
 * Variant sizes. The database stores amounts in base units (grams, millilitres, pieces) as
 * numeric(12,3); the UI lets the owner type kg / L too. Parsing uses integer thousandths, so
 * "1.25 kg" becomes exactly 1250 g (no float drift).
 */
export type SizeUnit = 'g' | 'ml' | 'pcs'
export type InputUnit = 'g' | 'kg' | 'ml' | 'L' | 'pcs'

export const INPUT_UNITS: InputUnit[] = ['g', 'kg', 'ml', 'L', 'pcs']

/** Sums for a group of order lines: quantity x size per unit, plus the quantity with no size. */
export interface MeasureTotals {
  grams: number
  ml: number
  pieces: number
  unsized: number
}

const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 })

/** 6250 g -> "6.25 kg", 750 g -> "750 g", 1500 ml -> "1.5 L", 6 pcs -> "6 pcs". */
export function formatMeasure(unit: SizeUnit, amount: number): string {
  if (unit === 'g')
    return amount >= 1000 ? `${num.format(amount / 1000)} kg` : `${num.format(amount)} g`
  if (unit === 'ml')
    return amount >= 1000 ? `${num.format(amount / 1000)} L` : `${num.format(amount)} ml`
  return `${num.format(amount)} pcs`
}

/**
 * The parts to show for a group, e.g. ["6.25 kg", "2 items"]. Unsized lines count as items.
 * Empty when there is nothing at all.
 */
export function formatTotals(t: MeasureTotals): string[] {
  const parts: string[] = []
  if (t.grams > 0) parts.push(formatMeasure('g', t.grams))
  if (t.ml > 0) parts.push(formatMeasure('ml', t.ml))
  if (t.pieces > 0) parts.push(formatMeasure('pcs', t.pieces))
  if (t.unsized > 0) parts.push(pluralize(t.unsized, 'item'))
  return parts
}

/** "1.25" -> 1250 thousandths; null if not a plain non-negative number with up to 3 decimals. */
function toThousandths(text: string): number | null {
  const m = /^(\d+)(?:\.(\d{1,3}))?$/.exec(text)
  if (!m) return null
  const value = Number(m[1]) * 1000 + Number((m[2] ?? '').padEnd(3, '0'))
  return Number.isSafeInteger(value) ? value : null
}

/** Integer thousandths -> exact decimal string, e.g. 1250 -> "1.25", 250000 -> "250". */
function thousandthsToString(value: number): string {
  const whole = Math.floor(value / 1000)
  const frac = String(value % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : String(whole)
}

export type SizeInput =
  | { ok: true; size: { size_amount: string; size_unit: SizeUnit } | null }
  | { ok: false; error: string }

/** Editor text + unit -> the upsert payload's size (base units). Empty text = no size. */
export function parseSizeInput(text: string, unit: InputUnit): SizeInput {
  const t = text.trim().replace(/,/g, '')
  if (t === '') return { ok: true, size: null }
  const th = toThousandths(t)
  if (th === null) return { ok: false, error: 'Up to 3 decimals' }
  if (th === 0) return { ok: false, error: 'Must be more than 0' }
  // kg / L: thousandths of a kg are grams, so the value is already the base amount.
  const big = unit === 'kg' || unit === 'L'
  const size_amount = big ? String(th) : thousandthsToString(th)
  const size_unit: SizeUnit = unit === 'kg' || unit === 'g' ? 'g' : unit === 'pcs' ? 'pcs' : 'ml'
  return { ok: true, size: { size_amount, size_unit } }
}

/** Stored size -> editor text + unit (1000 g or more is shown as kg, 1000 ml or more as L). */
export function sizeToInput(
  unit: SizeUnit | null,
  amount: number | null,
): { text: string; unit: InputUnit } {
  if (unit === null || amount === null) return { text: '', unit: 'g' }
  const th = Math.round(amount * 1000)
  // Only whole grams / ml switch to kg / L: 1250.5 g would need 4 decimals as kg and not re-parse.
  if (unit !== 'pcs' && th >= 1_000_000 && th % 1000 === 0) {
    return { text: thousandthsToString(th / 1000), unit: unit === 'g' ? 'kg' : 'L' }
  }
  return { text: thousandthsToString(th), unit }
}

/** Totals for order lines that each have a quantity and (maybe) a size. */
export function sumLines(
  lines: { quantity: number; size: { unit: SizeUnit; amount: number } | null }[],
): MeasureTotals {
  const th = { g: 0, ml: 0, pcs: 0 }
  let unsized = 0
  for (const l of lines) {
    if (l.size) th[l.size.unit] += Math.round(l.size.amount * 1000) * l.quantity
    else unsized += l.quantity
  }
  return { grams: th.g / 1000, ml: th.ml / 1000, pieces: th.pcs / 1000, unsized }
}

// ---- Boundary schemas (zod) ------------------------------------------------------------------------

/** A numeric(12,3) amount as PostgREST / jsonb returns it (number or string). */
export const dbAmount = z
  .union([z.number(), z.string()])
  .transform((v) => Number(v))
  .refine((n) => Number.isFinite(n) && n >= 0, 'invalid amount')

export const SizeUnitSchema = z.enum(['g', 'ml', 'pcs'])

/** grams / ml / pieces / unsized fields returned by prep_list() and analytics_month(). */
export const measureTotalsShape = {
  grams: dbAmount,
  ml: dbAmount,
  pieces: dbAmount,
  unsized: z.number().int().nonnegative(),
}
