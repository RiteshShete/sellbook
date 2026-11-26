import { describe, expect, it } from 'vitest'
import { parseImportText } from './parseImport'
import { planImport } from './planImport'

const HEAD = 'product_name,price,description,veg_type\n'
const parse = (body: string) => {
  const out = parseImportText(HEAD + body)
  if (!out.ok) throw new Error(out.message)
  return out.rows
}

describe('description and veg_type columns', () => {
  it('reads them, accepting the common spellings', () => {
    const rows = parse('Poha,60,"Flattened rice, quick",Veg\nChicken roll,90,,non-veg\nOmelette,40,,Egg\nTea,10,,')
    expect(rows.map((r) => r.vegType)).toEqual(['veg', 'non_veg', 'egg', null])
    expect(rows[0]?.description).toBe('Flattened rice, quick')
  })
  it('refuses a veg type it does not know and a very long description', () => {
    expect(parse('Poha,60,,jain')[0]?.errors).toContain('Veg type must be veg, non_veg or egg')
    expect(parse(`Poha,60,${'x'.repeat(2001)},`)[0]?.errors.join()).toMatch(/Description is over 2000/)
  })
  it('sends them with a NEW product only', () => {
    const plan = planImport({ products: [], categories: [] }, parse('Poha,60,Flattened rice,veg'), 'add', 'f.csv')
    expect(plan.payload.products[0]).toMatchObject({ description: 'Flattened rice', veg_type: 'veg' })
  })
  it('works without the columns (old files)', () => {
    const out = parseImportText('product_name,price\nPoha,60\n')
    if (!out.ok) throw new Error(out.message)
    const plan = planImport({ products: [], categories: [] }, out.rows, 'add', 'f.csv')
    expect(plan.payload.products[0]).toMatchObject({ description: null, veg_type: null })
  })
})
