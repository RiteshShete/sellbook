import { toBlob } from 'html-to-image'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { billFontCss } from './billFonts'
import { BILL_WIDTH, BillTemplate, type BillData } from './BillTemplate'
import { fitBill, ratiosFor } from './fitBill'

/**
 * Tallest bill (CSS px) we draw: room for the 60-line cap. Tall bills skip the sharpest ratios
 * (see ratiosFor) so the canvas stays under the iOS limit.
 */
const MAX_HEIGHT = 7000

/**
 * Renders the bill off-screen and returns a PNG Blob (1080 px wide, smaller only if needed to stay
 * within the 500 KB bills bucket limit).
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
    const capture = (pixelRatio: number) =>
      toBlob(node, {
        pixelRatio,
        backgroundColor: '#ffffff',
        width: BILL_WIDTH,
        height,
        cacheBust: false,
        fontEmbedCSS,
      })

    const ratios = ratiosFor(BILL_WIDTH, height)
    await capture(ratios[0] ?? 1) // warm-up: Safari often drops images/fonts on the first pass
    return await fitBill(capture, ratios)
  } finally {
    root.unmount()
    host.remove()
  }
}
