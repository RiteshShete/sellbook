import { BOM, toCsv } from '../../lib/csv'

/**
 * THE import schema. The column guide, template, example, AI instructions, header matching, unit
 * words and limits all come from this file, so they cannot drift apart (importSchema.test.ts
 * checks it). Change a column here and everything else follows.
 */

/** Units a CSV may use. "l" is litres (the editor writes it "L"). */
export const IMPORT_UNITS = ['g', 'kg', 'pcs', 'ml', 'l'] as const
export type ImportUnit = (typeof IMPORT_UNITS)[number]

export interface ImportColumn {
  name: string
  required: boolean
  /** Shown in the guide: what may go in this column. */
  allowed: string
  example: string
  meaning: string
}

export const IMPORT_COLUMNS = [
  {
    name: 'product_name',
    required: true,
    allowed: 'Text, up to 80 characters',
    example: 'मसाला चहा',
    meaning: 'The product. Repeat it on every row of its variants.',
  },
  {
    name: 'category',
    required: false,
    allowed: 'Text, up to 60 characters; blank = Uncategorised',
    example: 'Tea',
    meaning: 'Group shown on the Products screen. New categories are created for you.',
  },
  {
    name: 'variant_name',
    required: false,
    allowed: 'Text, up to 80 characters',
    example: 'Retail',
    meaning: 'A label for this size or type, such as Retail or Wholesale.',
  },
  {
    name: 'size',
    required: false,
    allowed: 'A number above 0, only together with unit',
    example: '250',
    meaning: 'How much one unit holds.',
  },
  {
    name: 'unit',
    required: false,
    allowed: 'g, kg, pcs, ml or l, only together with size',
    example: 'g',
    meaning: 'The unit of the size.',
  },
  {
    name: 'price',
    required: true,
    allowed: 'Rupees, 0 to 1,000,000, plain number',
    example: '120',
    meaning: 'Selling price of this variant.',
  },
  {
    name: 'cost_price',
    required: false,
    allowed: 'Rupees, same rules as price',
    example: '90',
    meaning: 'What it costs you. Stored, not shown yet.',
  },
  {
    name: 'active',
    required: false,
    allowed: 'yes or no (also true, false, 1, 0); blank = yes',
    example: 'yes',
    meaning: 'No keeps the variant hidden from new orders.',
  },
  {
    name: 'notes',
    required: false,
    allowed: 'Any text',
    example: 'CHECK',
    meaning: 'Not imported. If filled, the review shows "Flagged by AI, please check".',
  },
] as const satisfies readonly ImportColumn[]

export type ImportColumnName = (typeof IMPORT_COLUMNS)[number]['name']
export const COLUMN_NAMES: ImportColumnName[] = IMPORT_COLUMNS.map((c) => c.name)
export const REQUIRED_COLUMNS: ImportColumnName[] = IMPORT_COLUMNS.filter((c) => c.required).map(
  (c) => c.name,
)

/** The only header aliases allowed (after lower-casing and turning spaces / hyphens into _). */
export const HEADER_ALIASES: Record<string, ImportColumnName> = {
  name: 'product_name',
  product: 'product_name',
  rate: 'price',
  selling_price: 'price',
}

export const LIMITS = {
  maxBytes: 1024 * 1024,
  maxRows: 1000,
  productName: 80,
  variantName: 80,
  categoryName: 60,
  maxPricePaise: 1_000_000 * 100,
} as const

export const TRUE_WORDS = ['yes', 'true', '1', 'y']
export const FALSE_WORDS = ['no', 'false', '0', 'n']

/** Lower-cased spellings -> unit. Marathi words only where the meaning is safe. */
export const UNIT_SYNONYMS: Record<string, ImportUnit> = {
  g: 'g',
  gm: 'g',
  gms: 'g',
  gram: 'g',
  grams: 'g',
  ग्रॅम: 'g',
  kg: 'kg',
  kgs: 'kg',
  kilo: 'kg',
  किलो: 'kg',
  pcs: 'pcs',
  pc: 'pcs',
  piece: 'pcs',
  pieces: 'pcs',
  nos: 'pcs',
  नग: 'pcs',
  ml: 'ml',
  l: 'l',
  ltr: 'l',
  litre: 'l',
  liter: 'l',
  लिटर: 'l',
}

/** Example rows, Marathi and English, one product with two variants. */
export const EXAMPLE_ROWS: string[][] = [
  ['मसाला चहा', 'Tea', 'Retail', '250', 'g', '120', '90', 'yes', ''],
  ['मसाला चहा', 'Tea', 'Wholesale', '1', 'kg', '430', '340', 'yes', ''],
  ['Poha', 'Breakfast', '', '500', 'g', '60', '', 'yes', ''],
  ['शेंगदाणा लाडू', 'Sweets', '', '6', 'pcs', '150', '', 'yes', ''],
  ['Sabudana Khichdi Mix', 'Breakfast', '', '200', 'g', '85', '', 'yes', ''],
  ['गुलाब सरबत', 'Drinks', '', '750', 'ml', '140', '', 'yes', ''],
]

export const EXAMPLE_PRODUCT_NAMES = [...new Set(EXAMPLE_ROWS.map((r) => r[0] ?? ''))]

/** Pasted into an AI chat together with a photo of the price list. Verbatim, do not reword. */
export const AI_INSTRUCTIONS =
  'I am attaching a photo of my product list or menu. Convert it into CSV with exactly these columns in this order: product_name,category,variant_name,size,unit,price,cost_price,active,notes. Rules: 1) One row per variant. If a product has several sizes or types, repeat the product_name on each row. 2) Keep names exactly as written, in the original language and script (Marathi, Hindi or English). Do not translate or transliterate. 3) price is a plain number in rupees, with no currency symbol and no commas. 4) size is a plain number and unit is one of g, kg, pcs, ml, l. If no size is printed, leave size and unit empty. 5) variant_name is a label such as Retail or Wholesale; leave it empty if there is none. 6) category only if the list shows groups; otherwise leave it empty. 7) Leave cost_price empty unless it is printed; set active to yes. 8) If any text or price is unclear, give your best guess and write CHECK in the notes column. 9) Output only the CSV inside one code block, header row first, with no explanation.'

/** Header row text (for "Copy template text"). */
export const TEMPLATE_TEXT = COLUMN_NAMES.join(',')

/** Template file: the header row only, UTF-8 with BOM (Excel then shows Devanagari correctly). */
export const templateCsv = (): string => toCsv([COLUMN_NAMES])

/** Example file: header plus EXAMPLE_ROWS. */
export const exampleCsv = (): string => toCsv([COLUMN_NAMES, ...EXAMPLE_ROWS])

export const TEMPLATE_FILE = 'sellbook-products-template.csv'
export const EXAMPLE_FILE = 'sellbook-products-example.csv'

export { BOM }
