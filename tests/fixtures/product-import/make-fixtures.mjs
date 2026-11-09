// Regenerates the CSV fixtures next to this file:  node tests/fixtures/product-import/make-fixtures.mjs
// They are committed so tests never depend on this script running. Fake shop data only.
import { Buffer } from 'node:buffer'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const HEADER = 'product_name,category,variant_name,size,unit,price,cost_price,active,notes'
const out = (name, data) => writeFileSync(join(dir, name), data)
const BOM = '﻿'

const good = [
  HEADER,
  'Poha,Breakfast,,500,g,60,,yes,',
  'Poha,Breakfast,,1,kg,115,,yes,',
  'Chai Masala,Tea,Retail,100,g,80,55,yes,',
  'Chai Masala,Tea,Wholesale,1,kg,700,520,yes,',
  'Sharbat,Drinks,,750,ml,140,,no,',
].join('\n')
out('good.csv', `${good}\n`)
out('bom.csv', `${BOM}${good}\n`)
out(
  'excel-semicolon.csv',
  `${good
    .split('\n')
    .map((l) => l.replaceAll(',', ';'))
    .join('\r\n')}\r\n`,
)
out('crlf.csv', `${good.replaceAll('\n', '\r\n')}\r\n`)
out(
  'quoted-commas.csv',
  [HEADER, '"Chai, Masala",Tea,,100,g,80,,yes,', '"Nuts ""Mix""",Snacks,,250,g,150,,yes,', ''].join(
    '\n',
  ),
)
out(
  'devanagari-digits.csv',
  [HEADER, 'शेंगदाणा लाडू,गोड,,१.५,किलो,१२०,,yes,', 'चिवडा,,,२५०,ग्रॅम,६५.५०,,yes,', ''].join('\n'),
)
out(
  'rupee-prices.csv',
  [
    HEADER,
    'A,,,,,"₹1,250.50",,,',
    'B,,,,,Rs. 40,,,',
    'C,,,,,INR 99,,,',
    'D,,,,,120/-,,,',
    'E,,,,,12.345,,,',
    '',
  ].join('\n'),
)
// क्ष with a zero-width joiner between the letters is a different spelling from the one without;
// the two rows below must be treated as the same product for duplicate detection only.
out(
  'zero-width-joiners.csv',
  [HEADER, 'क्‍ष,,Retail,,,10,,,', 'क्ष,,Retail,,,10,,,', ''].join('\n'),
)
out(
  'duplicates.csv',
  [
    HEADER,
    'Poha,,Retail,500,g,60,,,',
    'POHA,,retail,500,g,62,,,',
    'Poha,,Retail,1,kg,115,,,',
    '',
  ].join('\n'),
)
out('missing-columns.csv', ['product_name,category', 'Poha,Breakfast', ''].join('\n'))
out('invalid-unit.csv', [HEADER, 'Poha,,,500,stone,60,,,', 'Rice,,,5,kg,300,,,', ''].join('\n'))
// Windows-1252 bytes: 0xE9 alone is not valid UTF-8.
writeFileSync(join(dir, 'non-utf8.csv'), Buffer.from(`${HEADER}\nCaf\xe9,,,,,50,,,\n`, 'latin1'))
const many = [HEADER]
for (let i = 1; i <= 1001; i += 1) many.push(`Item ${i},,,,,${i},,,`)
out('too-many-rows.csv', `${many.join('\n')}\n`)
out(
  'example.csv',
  `${BOM}${[
    HEADER,
    'मसाला चहा,Tea,Retail,250,g,120,90,yes,',
    'मसाला चहा,Tea,Wholesale,1,kg,430,340,yes,',
    'Poha,Breakfast,,500,g,60,,yes,',
    'शेंगदाणा लाडू,Sweets,,6,pcs,150,,yes,',
    'Sabudana Khichdi Mix,Breakfast,,200,g,85,,yes,',
    'गुलाब सरबत,Drinks,,750,ml,140,,yes,',
  ].join('\r\n')}\r\n`,
)
