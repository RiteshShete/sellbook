import { describe, expect, it } from 'vitest'
import { fixtureText } from './fixtures'
import {
  AI_INSTRUCTIONS,
  COLUMN_NAMES,
  EXAMPLE_ROWS,
  IMPORT_COLUMNS,
  IMPORT_UNITS,
  TEMPLATE_TEXT,
  UNIT_SYNONYMS,
  exampleCsv,
  templateCsv,
} from './importSchema'
import { parseImportText } from './parseImport'

describe('one schema drives everything', () => {
  it('template is only the header row, UTF-8 with BOM', () => {
    expect(templateCsv()).toBe(`\uFEFF${COLUMN_NAMES.join(',')}\r\n`)
    expect(TEMPLATE_TEXT).toBe(
      'product_name,category,variant_name,size,unit,price,cost_price,active,notes',
    )
  })

  it('AI instructions name the same columns, in order, and the same units', () => {
    expect(AI_INSTRUCTIONS).toContain(COLUMN_NAMES.join(','))
    expect(AI_INSTRUCTIONS).toContain(`one of ${IMPORT_UNITS.join(', ')}`)
  })

  it('the column guide has every column once', () => {
    expect(IMPORT_COLUMNS.map((c) => c.name)).toEqual(COLUMN_NAMES)
    expect(IMPORT_COLUMNS.filter((c) => c.required).map((c) => c.name)).toEqual([
      'product_name',
      'price',
    ])
  })

  it('every unit has a spelling of itself', () => {
    for (const u of IMPORT_UNITS) expect(UNIT_SYNONYMS[u]).toBe(u)
  })

  it('the example file parses with no errors and matches the committed fixture', () => {
    const out = parseImportText(exampleCsv())
    if (!out.ok) throw new Error(out.message)
    expect(out.rows).toHaveLength(EXAMPLE_ROWS.length)
    expect(out.rows.every((r) => r.errors.length === 0)).toBe(true)
    expect(out.looksLikeExample).toBe(true)
    expect(fixtureText('example.csv')).toBe(exampleCsv())
  })
})
