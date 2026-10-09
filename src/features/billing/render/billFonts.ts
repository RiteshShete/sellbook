import latin400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url'
import latin600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?url'
import latin700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?url'
// latin-ext carries the ₹ glyph (U+20B9).
import ext400 from '@fontsource/inter/files/inter-latin-ext-400-normal.woff2?url'
import ext600 from '@fontsource/inter/files/inter-latin-ext-600-normal.woff2?url'
import ext700 from '@fontsource/inter/files/inter-latin-ext-700-normal.woff2?url'

/** Own family name, so the bill never depends on the app's system font stack. */
const FAMILY = 'Sellbook Bill'
export const BILL_FONT = `'${FAMILY}', Arial, sans-serif`

const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F'
const LATIN_EXT = 'U+0100-024F,U+20A0-20C0'

const FACES = [
  { weight: 400, url: latin400, range: LATIN },
  { weight: 600, url: latin600, range: LATIN },
  { weight: 700, url: latin700, range: LATIN },
  { weight: 400, url: ext400, range: LATIN_EXT },
  { weight: 600, url: ext600, range: LATIN_EXT },
  { weight: 700, url: ext700, range: LATIN_EXT },
]

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Could not read file'))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(blob)
  })
}

let cssPromise: Promise<string> | null = null

/**
 * Self-hosted Inter as inline @font-face rules (data URLs). Injected into the page so the
 * off-screen bill lays out with it, and handed to html-to-image as fontEmbedCSS so it never
 * has to read stylesheets itself (that fails on Safari). Built once per session.
 */
export function billFontCss(): Promise<string> {
  cssPromise ??= (async () => {
    const rules = await Promise.all(
      FACES.map(async (f) => {
        const res = await fetch(f.url)
        if (!res.ok) throw new Error('Could not load the bill font')
        const src = await blobToDataUrl(await res.blob())
        return `@font-face{font-family:'${FAMILY}';font-style:normal;font-weight:${f.weight};font-display:block;src:url(${src}) format('woff2');unicode-range:${f.range};}`
      }),
    )
    const css = rules.join('\n')
    const style = document.createElement('style')
    style.dataset.billFonts = ''
    style.textContent = css
    document.head.appendChild(style)
    await Promise.all(
      [400, 600, 700].map((w) => document.fonts.load(`${w} 16px '${FAMILY}'`, 'Bill ₹0')),
    )
    return css
  })().catch((e: unknown) => {
    cssPromise = null // allow a retry on the next attempt
    throw e
  })
  return cssPromise
}
