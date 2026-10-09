export type CsvCell = string | number | null | undefined

/** UTF-8 byte order mark (U+FEFF). */
export const BOM = String.fromCharCode(0xfeff)

/** Text starting with these would run as a formula in Excel / Sheets (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/

/** One RFC 4180 field: quoted when it holds a comma, quote or line break; quotes doubled. */
export function csvField(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (typeof value === 'string' && FORMULA_START.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Rows -> CSV text with CRLF line ends and a UTF-8 byte order mark, so Excel opens ₹ and
 * other non-ASCII text correctly (Sheets ignores the mark).
 */
export function toCsv(rows: CsvCell[][]): string {
  return `${BOM}${rows.map((r) => r.map(csvField).join(',')).join('\r\n')}\r\n`
}
