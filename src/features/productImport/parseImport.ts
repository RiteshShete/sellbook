import Papa from 'papaparse'
import { formatMeasure, parseSizeInput, type InputUnit, type SizeUnit } from '../../lib/measure'
import { cleanSize, cleanText, mapUnit, normKey, parseActive, parseRupees } from './clean'
import {
  COLUMN_NAMES,
  EXAMPLE_PRODUCT_NAMES,
  HEADER_ALIASES,
  LIMITS,
  REQUIRED_COLUMNS,
  type ImportColumnName,
} from './importSchema'

export const ENCODING_MESSAGE = 'Save as CSV UTF-8 and try again.'

/** One CSV data row after cleaning. `errors` non-empty = the row cannot be imported. */
export interface ImportRow {
  /** The file's own line number (the header is row 1). */
  line: number
  productName: string
  category: string
  /** As given; may be blank (the planner then names it from the size). */
  variantName: string
  /** Base units (g / ml / pcs) as the database stores them, or null. */
  sizeAmount: string | null
  sizeUnit: SizeUnit | null
  /** "250 g", "1 kg", or "" when there is no size. */
  sizeLabel: string
  pricePaise: number | null
  costPaise: number | null
  /** null = not given. */
  active: boolean | null
  /** The notes column; non-empty means the AI flagged this row. */
  flagged: string
  errors: string[]
  warnings: string[]
}

export interface ParseFailure {
  ok: false
  kind: 'empty' | 'headers' | 'limit' | 'format' | 'encoding'
  message: string
}

export type ParseOutcome =
  ParseFailure | { ok: true; rows: ImportRow[]; fileWarnings: string[]; looksLikeExample: boolean }

/** Strict UTF-8: anything else is refused, never imported garbled. A leading BOM is dropped. */
export function decodeUtf8(bytes: Uint8Array): ParseFailure | { ok: true; text: string } {
  if (bytes.length > LIMITS.maxBytes) {
    return { ok: false, kind: 'limit', message: 'That file is over 1 MB. Split it and try again.' }
  }
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  } catch {
    return { ok: false, kind: 'encoding', message: ENCODING_MESSAGE }
  }
}

/** Comma, semicolon or tab: whichever the header line uses most outside quotes (comma on a tie). */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r\n|\n|\r/).find((l) => l.trim() !== '') ?? ''
  const counts = { ',': 0, ';': 0, '\t': 0 }
  let quoted = false
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && ch in counts) counts[ch as keyof typeof counts] += 1
  }
  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';'
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t'
  return ','
}

const headerKey = (cell: string): string =>
  cleanText(cell)
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

function columnFor(cell: string): ImportColumnName | null {
  const key = headerKey(cell)
  if ((COLUMN_NAMES as string[]).includes(key)) return key as ImportColumnName
  return HEADER_ALIASES[key] ?? null
}

function isBlankRow(r: string[]): boolean {
  return r.every((c) => c.trim() === '')
}

/** Parses CSV text into cleaned rows. Pure: no UI, no network. */
export function parseImportText(input: string): ParseOutcome {
  const text = input.replace(/^\uFEFF/, '')
  if (new TextEncoder().encode(text).length > LIMITS.maxBytes) {
    return { ok: false, kind: 'limit', message: 'That text is over 1 MB. Split it and try again.' }
  }
  if (text.trim() === '') {
    return { ok: false, kind: 'empty', message: 'The file is empty.' }
  }

  const parsed = Papa.parse<string[]>(text, {
    delimiter: detectDelimiter(text),
    skipEmptyLines: false,
  })
  if (parsed.errors.some((e) => e.code === 'MissingQuotes')) {
    return {
      ok: false,
      kind: 'format',
      message: 'A quote (") in the file is never closed. Check the file and try again.',
    }
  }

  // File line number of each parsed row: a quoted cell may hold line breaks.
  const lineOf: number[] = []
  let line = 1
  for (const r of parsed.data) {
    lineOf.push(line)
    line += 1 + r.reduce((n, c) => n + (c.match(/\n/g)?.length ?? 0), 0)
  }

  const headerAt = parsed.data.findIndex((r) => !isBlankRow(r))
  const headerCells = parsed.data[headerAt] ?? []
  const fileWarnings: string[] = []
  const colIndex = new Map<ImportColumnName, number>()
  headerCells.forEach((cell, i) => {
    const col = columnFor(cell)
    if (col === null) {
      if (cleanText(cell) !== '')
        fileWarnings.push(`Unknown column "${cleanText(cell)}" is ignored.`)
    } else if (colIndex.has(col)) {
      fileWarnings.push(`Column "${col}" appears twice; the first one is used.`)
    } else colIndex.set(col, i)
  })
  const missing = REQUIRED_COLUMNS.filter((c) => !colIndex.has(c))
  if (missing.length > 0) {
    return {
      ok: false,
      kind: 'headers',
      message: `The first row must have the columns ${missing.join(' and ')}. Use the template.`,
    }
  }

  const dataRows = parsed.data
    .map((cells, i) => ({ cells, line: lineOf[i] ?? i + 1 }))
    .filter((r, i) => i > headerAt && !isBlankRow(r.cells))
  if (dataRows.length === 0) {
    return { ok: false, kind: 'empty', message: 'The file has a header row but no products.' }
  }
  if (dataRows.length > LIMITS.maxRows) {
    return {
      ok: false,
      kind: 'limit',
      message: `The file has ${dataRows.length} rows; the limit is ${LIMITS.maxRows}. Split it and try again.`,
    }
  }

  const rows = dataRows.map(({ cells, line: n }) => {
    const cell = (c: ImportColumnName): string => {
      const i = colIndex.get(c)
      return i === undefined ? '' : (cells[i] ?? '')
    }
    return cleanRow(n, cell)
  })
  flagDuplicates(rows)

  const names = new Set(rows.map((r) => normKey(r.productName)))
  const looksLikeExample = EXAMPLE_PRODUCT_NAMES.every((n) => names.has(normKey(n)))
  return { ok: true, rows, fileWarnings, looksLikeExample }
}

function cleanRow(line: number, cell: (c: ImportColumnName) => string): ImportRow {
  const errors: string[] = []
  const warnings: string[] = []

  const productName = cleanText(cell('product_name'))
  if (productName === '') errors.push('Product name is missing')
  else if ([...productName].length > LIMITS.productName) {
    errors.push(`Product name is over ${LIMITS.productName} characters`)
  }
  const category = cleanText(cell('category'))
  if ([...category].length > LIMITS.categoryName) {
    errors.push(`Category is over ${LIMITS.categoryName} characters`)
  }
  const variantName = cleanText(cell('variant_name'))
  if ([...variantName].length > LIMITS.variantName) {
    errors.push(`Variant name is over ${LIMITS.variantName} characters`)
  }

  const price = parseRupees(cell('price'), 'Price')
  if (!price.ok) errors.push(price.error)
  else warnings.push(...price.warnings)

  const costRaw = cell('cost_price')
  let costPaise: number | null = null
  if (cleanText(costRaw) !== '') {
    const cost = parseRupees(costRaw, 'Cost price')
    if (!cost.ok) errors.push(cost.error)
    else {
      costPaise = cost.paise
      warnings.push(...cost.warnings)
    }
  }

  const sizeRaw = cleanText(cell('size'))
  const unitRaw = cleanText(cell('unit'))
  let sizeAmount: string | null = null
  let sizeUnit: SizeUnit | null = null
  let sizeLabel = ''
  if (sizeRaw !== '' && unitRaw === '') errors.push('Size needs a unit')
  else if (sizeRaw === '' && unitRaw !== '') errors.push('Unit needs a size')
  else if (sizeRaw !== '') {
    const unit = mapUnit(unitRaw)
    const size = cleanSize(sizeRaw)
    if (unit === null) errors.push(`Unknown unit "${unitRaw}" (use g, kg, pcs, ml or l)`)
    else if (size === null) errors.push(`Size "${sizeRaw}" is not a number`)
    else {
      const r = parseSizeInput(size, unit === 'l' ? ('L' as InputUnit) : unit)
      if (!r.ok) errors.push(`Size "${sizeRaw}": ${r.error}`)
      else if (r.size) {
        sizeAmount = r.size.size_amount
        sizeUnit = r.size.size_unit
        sizeLabel = formatMeasure(sizeUnit, Number(sizeAmount))
      }
    }
  }

  const activeRaw = parseActive(cell('active'))
  if (activeRaw === undefined) errors.push('Active must be yes or no')

  const flagged = cleanText(cell('notes'))
  return {
    line,
    productName,
    category,
    variantName,
    sizeAmount,
    sizeUnit,
    sizeLabel,
    pricePaise: price.ok ? price.paise : null,
    costPaise,
    active: activeRaw ?? null,
    flagged,
    errors,
    warnings,
  }
}

/** Same product + variant + size + unit twice: the later row is an error. */
function flagDuplicates(rows: ImportRow[]): void {
  const first = new Map<string, number>()
  for (const r of rows) {
    if (r.productName === '') continue
    const key = [normKey(r.productName), normKey(r.variantName), r.sizeAmount, r.sizeUnit].join('|')
    const earlier = first.get(key)
    if (earlier === undefined) first.set(key, r.line)
    else r.errors.push(`Duplicate of row ${earlier} (same product, variant, size and unit)`)
  }
}
