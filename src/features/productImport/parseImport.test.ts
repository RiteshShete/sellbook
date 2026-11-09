import { describe, expect, it } from 'vitest'
import { fixtureBytes, fixtureText } from './fixtures'
import {
  ENCODING_MESSAGE,
  decodeUtf8,
  detectDelimiter,
  parseImportText,
  type ImportRow,
} from './parseImport'

function rowsOf(name: string): ImportRow[] {
  const out = parseImportText(fixtureText(name))
  if (!out.ok) throw new Error(`${name}: ${out.message}`)
  return out.rows
}

describe('files that must parse the same', () => {
  const good = rowsOf('good.csv')
  it('good file', () => {
    expect(good).toHaveLength(5)
    expect(good.every((r) => r.errors.length === 0)).toBe(true)
    expect(good[1]).toMatchObject({
      productName: 'Poha',
      sizeAmount: '1000',
      sizeUnit: 'g',
      sizeLabel: '1 kg',
      pricePaise: 11500,
    })
    expect(good[4]).toMatchObject({ active: false })
  })
  it.each(['bom.csv', 'excel-semicolon.csv', 'crlf.csv'])('%s gives the same rows', (name) => {
    expect(rowsOf(name)).toEqual(good)
  })
})

describe('row numbers are the file line numbers (header is row 1)', () => {
  it('counts blank lines and quoted line breaks', () => {
    const out = parseImportText('product_name,price\nA,1\n\n"B\nsecond line",2\nC,3\n')
    if (!out.ok) throw new Error(out.message)
    expect(out.rows.map((r) => [r.productName, r.line])).toEqual([
      ['A', 2],
      ['B second line', 4],
      ['C', 6],
    ])
  })
})

describe('quoting, digits, prices, joiners', () => {
  it('keeps commas and quotes inside names', () => {
    expect(rowsOf('quoted-commas.csv').map((r) => r.productName)).toEqual([
      'Chai, Masala',
      'Nuts "Mix"',
    ])
  })
  it('reads Devanagari digits and Marathi units', () => {
    const [a, b] = rowsOf('devanagari-digits.csv')
    expect(a).toMatchObject({
      sizeAmount: '1500',
      sizeUnit: 'g',
      sizeLabel: '1.5 kg',
      pricePaise: 12000,
      errors: [],
    })
    expect(b).toMatchObject({ sizeAmount: '250', sizeUnit: 'g', pricePaise: 6550, errors: [] })
  })
  it('cleans rupee signs and thousands commas with warnings, and rounds', () => {
    const rows = rowsOf('rupee-prices.csv')
    expect(rows.map((r) => r.pricePaise)).toEqual([125050, 4000, 9900, 12000, 1235])
    expect(rows.every((r) => r.errors.length === 0 && r.warnings.length > 0)).toBe(true)
  })
  it('never alters a stored name with a zero-width joiner, but treats it as a duplicate', () => {
    const [a, b] = rowsOf('zero-width-joiners.csv')
    expect(a?.productName).toBe('क्\u200Dष')
    expect(b?.productName).toBe('क्ष')
    expect(a?.errors).toEqual([])
    expect(b?.errors.join()).toContain('Duplicate of row 2')
  })
})

describe('errors stay on their own rows', () => {
  it('flags duplicates (case-insensitive) but not a different size', () => {
    const rows = rowsOf('duplicates.csv')
    expect(rows[0]?.errors).toEqual([])
    expect(rows[1]?.errors.join()).toContain('Duplicate of row 2')
    expect(rows[2]?.errors).toEqual([])
  })
  it('unknown unit is a row error, the next row is fine', () => {
    const rows = rowsOf('invalid-unit.csv')
    expect(rows[0]?.errors.join()).toContain('Unknown unit "stone"')
    expect(rows[1]?.errors).toEqual([])
  })
  it('size without unit and unit without size', () => {
    const out = parseImportText('product_name,size,unit,price\nA,5,,1\nB,,kg,1\nC,0,g,1\nD,x,g,1\n')
    if (!out.ok) throw new Error(out.message)
    expect(out.rows.map((r) => r.errors[0])).toEqual([
      'Size needs a unit',
      'Unit needs a size',
      'Size "0": Must be more than 0',
      'Size "x" is not a number',
    ])
  })
  it('missing name, bad price, over-long names', () => {
    const long = 'x'.repeat(81)
    const out = parseImportText(
      `product_name,variant_name,price\n,A,1\nB,,abc\n${long},,1\nC,${long},1\n`,
    )
    if (!out.ok) throw new Error(out.message)
    expect(out.rows.map((r) => r.errors[0])).toEqual([
      'Product name is missing',
      'Price "abc" is not a number',
      'Product name is over 80 characters',
      'Variant name is over 80 characters',
    ])
  })
  it('notes are flagged, not imported', () => {
    const out = parseImportText('product_name,price,notes\nA,1,CHECK\nB,2,\n')
    if (!out.ok) throw new Error(out.message)
    expect(out.rows.map((r) => r.flagged)).toEqual(['CHECK', ''])
  })
})

describe('headers', () => {
  it('matches case-insensitively with spaces / hyphens and the allowed aliases', () => {
    const out = parseImportText('Product Name,Selling-Price,CATEGORY\nA,5,Tea\n')
    if (!out.ok) throw new Error(out.message)
    expect(out.rows[0]).toMatchObject({ productName: 'A', pricePaise: 500, category: 'Tea' })
    const alias = parseImportText('name,rate\nA,5\n')
    expect(alias.ok && alias.rows[0]?.pricePaise).toBe(500)
    const alias2 = parseImportText('product,price\nA,5\n')
    expect(alias2.ok).toBe(true)
  })
  it('warns about unknown columns and ignores them', () => {
    const out = parseImportText('product_name,price,colour\nA,5,red\n')
    expect(out.ok && out.fileWarnings).toEqual(['Unknown column "colour" is ignored.'])
  })
  it('missing required columns stops with a friendly message', () => {
    const out = parseImportText(fixtureText('missing-columns.csv'))
    expect(out).toMatchObject({ ok: false, kind: 'headers' })
    expect(!out.ok && out.message).toContain('price')
  })
})

describe('whole-file problems', () => {
  it('empty and header-only files', () => {
    expect(parseImportText('  \n ')).toMatchObject({ ok: false, kind: 'empty' })
    expect(parseImportText('product_name,price\n')).toMatchObject({ ok: false, kind: 'empty' })
  })
  it('1,001 rows is over the limit, 1,000 is fine', () => {
    expect(parseImportText(fixtureText('too-many-rows.csv'))).toMatchObject({
      ok: false,
      kind: 'limit',
    })
    const thousand = [
      'product_name,price',
      ...Array.from({ length: 1000 }, (_, i) => `P${i},1`),
    ].join('\n')
    expect(parseImportText(thousand).ok).toBe(true)
  })
  it('non-UTF-8 bytes are refused, never imported garbled', () => {
    expect(decodeUtf8(fixtureBytes('non-utf8.csv'))).toEqual({
      ok: false,
      kind: 'encoding',
      message: ENCODING_MESSAGE,
    })
    expect(ENCODING_MESSAGE).toBe('Save as CSV UTF-8 and try again.')
  })
  it('valid UTF-8 (with BOM) decodes without the BOM', () => {
    const r = decodeUtf8(fixtureBytes('bom.csv'))
    expect(r.ok && r.text.startsWith('product_name')).toBe(true)
  })
  it('over 1 MB is refused', () => {
    expect(decodeUtf8(new Uint8Array(1024 * 1024 + 1))).toMatchObject({ ok: false, kind: 'limit' })
  })
  it('detects comma, semicolon and tab', () => {
    expect(detectDelimiter('a,b,c')).toBe(',')
    expect(detectDelimiter('a;b;c')).toBe(';')
    expect(detectDelimiter('a\tb\tc')).toBe('\t')
    expect(detectDelimiter('"a;b",c')).toBe(',')
  })
})
