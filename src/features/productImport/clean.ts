import { FALSE_WORDS, LIMITS, TRUE_WORDS, UNIT_SYNONYMS, type ImportUnit } from './importSchema'

/** Control characters (tabs and line breaks included). Zero-width joiners are NOT control characters. */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g
/** Zero-width space / non-joiner / joiner / BOM: removed from duplicate-detection keys ONLY. */
const ZERO_WIDTH = /\u200B|\u200C|\u200D|\uFEFF/g

/** Devanagari digits ०-९ to 0-9. */
export function devanagariDigits(s: string): string {
  return s.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
}

/**
 * Cell text as stored: NFC, control characters become spaces, repeated spaces collapse, trimmed.
 * Joiners are kept: they change how Devanagari is spelled.
 */
export function cleanText(s: string): string {
  return s.normalize('NFC').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim()
}

/** Case-insensitive duplicate key. The stored name is never altered. */
export function normKey(s: string): string {
  return cleanText(s).replace(ZERO_WIDTH, '').toLowerCase()
}

export type NumberResult =
  { ok: true; paise: number; warnings: string[] } | { ok: false; error: string }

/**
 * Rupees text to integer paise. Strips Rs / Rs. / INR / the rupee sign, thousands commas and a
 * trailing "/-" (each reported as "cleaned"); rounds to 2 decimals half-up (reported). Pure string
 * arithmetic, no floats.
 */
export function parseRupees(raw: string, label: string): NumberResult {
  let s = cleanText(devanagariDigits(raw))
  if (s === '') return { ok: false, error: `${label} is missing` }
  const warnings: string[] = []
  const stripped = s
    .replace(/^(?:rs\.?|inr|₹)\s*/i, '')
    .replace(/\s*\/-$/, '')
    .replace(/,/g, '')
  if (stripped !== s) warnings.push(`${label} "${s}" was cleaned to "${stripped}"`)
  s = stripped
  if (!/^\d+(?:\.\d+)?$/.test(s)) return { ok: false, error: `${label} "${s}" is not a number` }
  const [whole = '0', frac = ''] = s.split('.')
  let paise = Number(whole) * 100 + Number(frac.slice(0, 2).padEnd(2, '0'))
  if (frac.length > 2) {
    if (Number(frac[2]) >= 5) paise += 1
    warnings.push(`${label} "${s}" was rounded to 2 decimals`)
  }
  if (!Number.isSafeInteger(paise) || paise > LIMITS.maxPricePaise) {
    return { ok: false, error: `${label} must be between 0 and 1,000,000` }
  }
  return { ok: true, paise, warnings }
}

/** "gm", "Kilo", "ग्रॅम" ... to a unit, or null when unknown. */
export function mapUnit(raw: string): ImportUnit | null {
  const key = cleanText(raw).toLowerCase().replace(/\.$/, '')
  return UNIT_SYNONYMS[key] ?? null
}

/** A size such as "250" or "१.५"? Plain decimal only ("1,5" is rejected, not guessed). Cleaned text or null. */
export function cleanSize(raw: string): string | null {
  const s = cleanText(devanagariDigits(raw))
  return /^\d+(?:\.\d+)?$/.test(s) ? s : null
}

/** yes/no (also true/false/1/0). null when blank, undefined when unrecognised. */
export function parseActive(raw: string): boolean | null | undefined {
  const s = cleanText(devanagariDigits(raw)).toLowerCase()
  if (s === '') return null
  if (TRUE_WORDS.includes(s)) return true
  if (FALSE_WORDS.includes(s)) return false
  return undefined
}
