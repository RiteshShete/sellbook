import { normalizePhone } from '../../../lib/phone'
import { variantSizeText } from '../../../lib/variants'
import { normalizeSearch } from '../../catalog/categories'
import type { Product, Variant } from '../../catalog/schemas'
import { MAX_QTY } from '../schemas'

/**
 * Turns what the owner said ("Modak Pith 1 kg 2, कण्हेरी 3, Ravi, 98765 43210") into order lines, a customer
 * name and a phone, by matching against the catalog. Pure and local: no network, no AI.
 *
 * shortcut: product names are matched as written in the catalog (one typo of 1 letter allowed on words of 5+),
 * the variant must be spoken AFTER its product, and number words stop at ten. Upgrade when real use shows misses.
 */
export interface VoiceResult {
  items: { product: Product; variant: Variant; quantity: number }[]
  /** Products heard but with several sizes and none spoken: the owner picks the size by hand. */
  ambiguous: string[]
  name: string | null
  /** Digits with country code (`normalizePhone`), or null. */
  phone: string | null
  /** Words that matched nothing and were not a plausible name. */
  unmatched: string
}

interface Tok {
  raw: string
  norm: string
  used: boolean
}

/** English, Hindi and Marathi number words, one to ten. */
const WORDS = new Map<string, number>([
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
  ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ['एक', 1], ['दो', 2], ['तीन', 3], ['चार', 4], ['पांच', 5], ['पाँच', 5],
  ['छह', 6], ['छः', 6], ['सात', 7], ['आठ', 8], ['नौ', 9], ['दस', 10],
  ['दोन', 2], ['पाच', 5], ['सहा', 6], ['नऊ', 9], ['दहा', 10],
])

/** Spoken glue that is neither a name nor an item. */
const FILLERS = new Set(
  (
    'name customer for order phone number mobile no and is plus the add please ok g kg gram grams ml pcs ' +
    'नाम ग्राहक के लिए ऑर्डर फोन नंबर मोबाइल और का है किलो ग्राम ' +
    'नाव साठी आणि चे आहे मोबाईल ग्रॅम'
  ).split(' '),
)

const toAscii = (s: string) => s.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x966))
const words = (s: string) => normalizeSearch(s).split(/\s+/).filter(Boolean)

function editDistance(a: string, b: string): number {
  const x = Array.from(a)
  const y = Array.from(b)
  let prev = y.map((_, j) => j + 1)
  prev.unshift(0)
  x.forEach((cx, i) => {
    const row = [i + 1]
    y.forEach((cy, j) => {
      row.push(Math.min((prev[j + 1] ?? 0) + 1, (row[j] ?? 0) + 1, (prev[j] ?? 0) + (cx === cy ? 0 : 1)))
    })
    prev = row
  })
  return prev[y.length] ?? 0
}

/** Same word, allowing one slip on long non-numeric words (speech spells names its own way). */
function same(a: string, b: string): boolean {
  if (a === b) return true
  if (/\d/.test(a) || /\d/.test(b) || Math.min(a.length, b.length) < 5) return false
  return editDistance(a, b) <= 1
}

function numberOf(t: Tok): number | null {
  const n = /^\d+$/.test(t.norm) ? Number(t.norm) : WORDS.get(t.norm)
  return n !== undefined && Number.isSafeInteger(n) && n >= 1 && n <= MAX_QTY ? n : null
}

/** Finds the first run of unused tokens in [from, to) that spells `seq`; -1 if none. */
function findSeq(toks: Tok[], from: number, to: number, seq: string[]): number {
  if (seq.length === 0) return -1
  for (let i = from; i + seq.length <= to; i++) {
    const hit = seq.every((s, k) => {
      const t = toks[i + k]
      return t !== undefined && !t.used && same(t.norm, s)
    })
    if (hit) return i
  }
  return -1
}

const markUsed = (toks: Tok[], at: number, len: number) =>
  toks.slice(at, at + len).forEach((t) => (t.used = true))

/** Pulls an Indian mobile number out of the text, even when spoken in chunks or glued to a quantity. */
function extractPhone(text: string): { phone: string | null; rest: string } {
  const found = { phone: null as string | null }
  const rest = text.replace(/\d(?:[ -]?\d)*/g, (run) => {
    if (found.phone) return run
    const digits = run.replace(/\D/g, '')
    const whole = normalizePhone(digits)
    if (whole) {
      found.phone = whole
      return ' '
    }
    const tail = digits.length > 10 ? normalizePhone(digits.slice(-10)) : null
    if (!tail) return run
    found.phone = tail
    return ` ${digits.slice(0, -10)} ` // the leading digits were a quantity
  })
  return { phone: found.phone, rest }
}

/** The variant spoken in [from, to), else the only one; null = several sizes and none said. */
function pickVariant(p: Product, toks: Tok[], from: number, to: number): Variant | null {
  let best: { v: Variant; at: number; len: number } | null = null
  let tie = false
  for (const v of p.variants) {
    for (const cand of [v.name, variantSizeText(v)]) {
      const seq = cand ? words(cand) : []
      const at = findSeq(toks, from, to, seq)
      if (at < 0) continue
      if (!best || seq.length > best.len) {
        best = { v, at, len: seq.length }
        tie = false
      } else if (seq.length === best.len && best.v.id !== v.id) tie = true
    }
  }
  if (best && !tie) {
    markUsed(toks, best.at, best.len)
    return best.v
  }
  return !best && p.variants.length === 1 ? (p.variants[0] ?? null) : null
}

/** `products` must already be the sellable ones (active product, active variants). */
export function parseVoiceOrder(transcript: string, products: Product[]): VoiceResult {
  const { phone, rest } = extractPhone(toAscii(transcript))
  const toks: Tok[] = rest
    .split(/[\s,;।]+/)
    .map((raw) => raw.replace(/^[.!?]+|[.!?]+$/g, ''))
    .filter(Boolean)
    .map((raw) => ({ raw, norm: normalizeSearch(raw), used: false }))

  // 1. Product names, longest first so "Modak Pith" wins over "Modak".
  const found: { product: Product; start: number; end: number }[] = []
  for (const p of [...products].sort((a, b) => words(b.name).length - words(a.name).length)) {
    const seq = words(p.name)
    let at = findSeq(toks, 0, toks.length, seq)
    while (at >= 0) {
      markUsed(toks, at, seq.length)
      found.push({ product: p, start: at, end: at + seq.length })
      at = findSeq(toks, at + seq.length, toks.length, seq)
    }
  }
  found.sort((a, b) => a.start - b.start)

  // 2. "2 Modak Pith" (quantity first) or "Modak Pith 2" (after): decided by a number before the first product.
  const firstStart = found[0]?.start ?? 0
  const quantityFirst = toks.slice(0, firstStart).some((t) => !t.used && numberOf(t) !== null)

  const items: VoiceResult['items'] = []
  const ambiguous: string[] = []
  found.forEach((m, i) => {
    const segEnd = found[i + 1]?.start ?? toks.length
    const variant = pickVariant(m.product, toks, m.end, segEnd)
    if (!variant) {
      ambiguous.push(m.product.name)
      return
    }
    const range = quantityFirst ? [found[i - 1]?.end ?? 0, m.start] : [m.end, segEnd]
    const candidates = toks
      .map((t, at) => ({ t, at }))
      .slice(range[0], range[1])
      .filter(({ t }) => !t.used && numberOf(t) !== null)
    const pick = quantityFirst ? candidates[candidates.length - 1] : candidates[0]
    if (pick) pick.t.used = true
    items.push({ product: m.product, variant, quantity: (pick && numberOf(pick.t)) || 1 })
  })

  // 3. What is left: a short name, or "not understood".
  const left = toks.filter((t) => !t.used && !FILLERS.has(t.norm))
  const textual = left.filter((t) => !/^\d+$/.test(t.norm))
  const name = textual.length >= 1 && textual.length <= 4 ? textual.map((t) => t.raw).join(' ') : null
  const unmatched = left
    .filter((t) => name === null || !textual.includes(t))
    .map((t) => t.raw)
    .join(' ')

  return { items, ambiguous, name, phone, unmatched }
}
