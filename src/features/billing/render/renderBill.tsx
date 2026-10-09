import { toBlob } from 'html-to-image'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { billFontCss } from './billFonts'
import { BILL_WIDTH, BillTemplate, type BillData } from './BillTemplate'

const PIXEL_RATIO = 2
/** iOS canvas limit is ~16.7M px; 1080 x 7000 stays far below it. */
const MAX_HEIGHT = 3500
/** A real bill PNG is tens of KB; anything this small is a blank (Safari first-pass) capture. */
const MIN_BYTES = 8_000

/**
 * Renders the bill off-screen and returns a PNG Blob (1080 px wide).
 * Safari quirks handled: fonts inlined up front, images awaited with decode(), a discarded
 * warm-up capture, and one retry when the output looks blank.
 */
export async function renderBill(data: BillData): Promise<Blob> {
  const fontEmbedCSS = await billFontCss()

  // Off-screen but laid out: display:none / visibility:hidden would capture as blank.
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${BILL_WIDTH}px;pointer-events:none`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    flushSync(() => root.render(<BillTemplate data={data} />))
    const node = host.firstElementChild
    if (!(node instanceof HTMLElement)) throw new Error('Bill did not render')

    await Promise.all(
      Array.from(node.querySelectorAll('img'), (img) =>
        img.decode().catch(() => {
          throw new Error('A bill image (logo or QR) could not be loaded')
        }),
      ),
    )
    await document.fonts.ready

    const height = Math.ceil(node.scrollHeight)
    if (height > MAX_HEIGHT) throw new Error('This bill is too long for one image.')
    const capture = () =>
      toBlob(node, {
        pixelRatio: PIXEL_RATIO,
        backgroundColor: '#ffffff',
        width: BILL_WIDTH,
        height,
        cacheBust: false,
        fontEmbedCSS,
      })

    await capture() // warm-up: Safari often drops images/fonts on the first pass
    let blob = await capture()
    if (!blob || blob.size < MIN_BYTES) blob = await capture()
    if (!blob || blob.size < MIN_BYTES) throw new Error('Could not draw the bill. Try again.')
    return blob
  } finally {
    root.unmount()
    host.remove()
  }
}
