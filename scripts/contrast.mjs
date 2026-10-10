// WCAG 2.2 contrast check for every foreground/background token pair the UI uses.
// Reads the :root tokens from src/index.css, so the table always matches the real theme.
//   node scripts/contrast.mjs          prints the table (markdown); exit 1 if a pair fails
//   node scripts/contrast.mjs --json   machine-readable
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
const raw = Object.fromEntries(
  [...root.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
)

function resolve(name, depth = 0) {
  const v = raw[name]
  if (v === undefined || depth > 8) throw new Error(`Unknown token --${name}`)
  const ref = /^var\(--([\w-]+)\)$/.exec(v)
  return ref ? resolve(ref[1], depth + 1) : v
}

const rgb = (hex) => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
const lin = (c) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const blend = (fg, bg, a) => fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)))
export function ratio(fgHex, bgHex, alpha = 1) {
  const bg = rgb(bgHex)
  const fg = alpha < 1 ? blend(rgb(fgHex), bg, alpha) : rgb(fgHex)
  const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

/** kind: text (4.5), large (3), ui (3: icons, input borders, focus rings). */
const NEED = { text: 4.5, large: 3, ui: 3 }
const P = (kind, where, fg, bg, alpha = 1) => ({ kind, where, fg, bg, alpha })

export const PAIRS = [
  // Page text
  P('text', 'Body text on page', 'text', 'bg'),
  P('text', 'Body text on cream card (surface-2)', 'text', 'surface-2'),
  P('text', 'Muted text on page', 'muted', 'bg'),
  P('text', 'Muted text on cream card', 'muted', 'surface-2'),
  P('text', 'Body (#3a3a3a) on page', 'body', 'bg'),
  // Buttons
  P('text', 'Primary button', 'primary-fg', 'primary'),
  P('text', 'Primary button pressed', 'primary-fg', 'primary-active'),
  P('text', 'Primary button disabled', 'disabled-fg', 'primary-disabled'),
  P('text', 'Secondary button', 'text', 'surface'),
  P('text', 'Danger button', 'on-solid', 'danger'),
  P('text', 'Ready action button', 'on-solid', 'info'),
  P('text', 'Delivered action button', 'on-solid', 'success'),
  P('text', 'Paid action button', 'on-solid', 'teal'),
  P('text', 'Danger text on page', 'danger', 'bg'),
  P('text', 'Success text on page', 'success', 'bg'),
  P('text', 'Warning text on page', 'warning', 'bg'),
  // Badges
  P('text', 'Badge: neutral', 'text', 'surface-2'),
  P('text', 'Badge: Ready', 'info-ink', 'info-soft'),
  P('text', 'Badge: Delivered', 'success-ink', 'success-soft'),
  P('text', 'Badge: Paid', 'on-solid', 'teal'),
  P('text', 'Badge: Not paid', 'danger-ink', 'danger-soft'),
  P('text', 'Badge: Due today', 'text', 'ochre'),
  P('text', 'Badge: Overdue', 'on-solid', 'danger-deep'),
  // KPI cards (Home)
  P('text', 'KPI card label on lavender (ink 70%)', 'text', 'lavender', 0.7),
  P('text', 'KPI card value on lavender', 'text', 'lavender'),
  P('text', 'KPI card label on mint (ink 70%)', 'text', 'mint', 0.7),
  P('text', 'KPI card label on peach (ink 70%)', 'text', 'peach', 0.7),
  P('text', 'Tab-bar count on coral', 'text', 'coral'),
  // Non-text
  P('ui', 'Input border on page', 'border-strong', 'bg'),
  P('ui', 'Input border on cream card', 'border-strong', 'surface-2'),
  P('ui', 'Focus ring (ink) on page', 'text', 'bg'),
  P('ui', 'Muted icon on page', 'muted', 'bg'),
  P('ui', 'Switch track (off) on page', 'border-strong', 'bg'),
  P('ui', 'Hairline divider (decorative, exempt)', 'border', 'bg'),
]

const tok = (n) => (n === 'on-solid' ? '#ffffff' : resolve(n))

export function evaluate() {
  return PAIRS.map((p) => {
    const r = ratio(tok(p.fg), tok(p.bg), p.alpha)
    const need = p.where.includes('decorative') ? 0 : NEED[p.kind]
    return { ...p, ratio: r, need, pass: r >= need }
  })
}

if (process.argv[1] && process.argv[1].endsWith('contrast.mjs')) {
  const rows = evaluate()
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2))
  else {
    console.log('| Where | Foreground | Background | Ratio | Needs | Result |')
    console.log('|---|---|---|---|---|---|')
    for (const r of rows) {
      const fg = `${r.fg}${r.alpha < 1 ? ` @${r.alpha * 100}%` : ''} ${tok(r.fg)}`
      console.log(
        `| ${r.where} | ${fg} | ${r.bg} ${tok(r.bg)} | ${r.ratio.toFixed(2)} | ${r.need || 'n/a'} | ${r.pass ? 'pass' : 'FAIL'} |`,
      )
    }
  }
  process.exitCode = evaluate().some((r) => !r.pass) ? 1 : 0
}
