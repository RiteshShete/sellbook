// What does a customer download to see a shop's catalogue? Adds up (gzipped) the files the page needs: the app entry,
// everything it loads at start (index.html), the catalogue page's own chunk and that chunk's static imports, and the CSS.
// Pictures are not counted (they are separate files). Fails above the budget (STOREFRONT_PLAN 9.5).
// Run after `npm run build`:  node scripts/bundle-size.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { gzipSync } from 'node:zlib'

// The plan's budget; set BUNDLE_BUDGET_KB to try another figure. (Not part of `npm run check` until the owner settles the figure.)
const BUDGET = Number(process.env.BUNDLE_BUDGET_KB ?? 200) * 1024
const dist = 'dist'
const assets = join(dist, 'assets')
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html not found: run `npm run build` first.')
  process.exit(2)
}

const html = readFileSync(join(dist, 'index.html'), 'utf8')
// root-relative ("/assets/x.js") and base-path ("/sellbook/assets/x.js") links alike
const fromHtml = [...html.matchAll(/(?:src|href)="[^"]*\/assets\/([^"]+\.(?:js|css))"/g)].map((m) => basename(m[1] ?? ''))

/** A chunk and the chunks it imports STATICALLY (dynamic imports load later, only when needed). */
function closure(file, seen = new Set()) {
  if (seen.has(file) || !existsSync(join(assets, file))) return seen
  seen.add(file)
  if (file.endsWith('.js')) {
    const code = readFileSync(join(assets, file), 'utf8')
    for (const m of code.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) {
      // `import("./x.js")` is dynamic (preceded by "("): skip it; the regex above only matches `from"./x"` and `import"./x"`.
      closure(m[1] ?? '', seen)
    }
  }
  return seen
}

const pageChunk = readdirSync(assets).find((f) => /^StoreCatalogPage-.*\.js$/.test(f))
if (!pageChunk) {
  console.error('No StoreCatalogPage chunk found: was the storefront built in?')
  process.exit(2)
}
const needed = new Set()
for (const f of [...fromHtml, pageChunk]) closure(f, needed)

const rows = [...needed].map((f) => ({ file: f, gz: gzipSync(readFileSync(join(assets, f))).length })).sort((a, b) => b.gz - a.gz)
const total = rows.reduce((n, r) => n + r.gz, 0)
const showAll = process.argv.includes('--all') // every file, not just the biggest
for (const r of showAll ? rows : rows.slice(0, 8)) console.log(`${(r.gz / 1024).toFixed(1).padStart(7)} kB  ${r.file}`)
console.log(`${(total / 1024).toFixed(1).padStart(7)} kB  TOTAL gzipped for the catalogue page (${rows.length} files, budget ${BUDGET / 1024} kB)`)
if (total > BUDGET) {
  console.error('Over budget.')
  process.exitCode = 1
}
