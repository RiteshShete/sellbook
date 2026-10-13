import { MAX_BILL_BYTES } from '../schemas'

/** Sharpest first. 1 = the bill's own 540 px width; 0.75 (405 px) is the last resort for very long bills. */
export const PIXEL_RATIOS = [2, 1.5, 1.25, 1, 0.75]

/** iOS Safari fails above ~16.7M canvas pixels; stay well under it. */
export const MAX_CANVAS_PIXELS = 12_000_000

/** The ratios whose canvas (width x height at that ratio) is safe to draw. Always keeps the smallest. */
export function ratiosFor(
  width: number,
  height: number,
  ratios: number[] = PIXEL_RATIOS,
): number[] {
  const safe = ratios.filter((r) => width * r * (height * r) <= MAX_CANVAS_PIXELS)
  return safe.length > 0 ? safe : ratios.slice(-1)
}

/** A real bill PNG is tens of KB; anything this small is a blank (Safari first-pass) capture. */
export const MIN_BILL_BYTES = 8_000

/**
 * Draws the bill at the sharpest ratio whose PNG is at most `maxBytes` (the bills bucket limit).
 * `draw` may return null/blank on Safari's first pass, so each ratio gets one retry.
 */
export async function fitBill(
  draw: (pixelRatio: number) => Promise<Blob | null>,
  ratios: number[] = PIXEL_RATIOS,
  maxBytes: number = MAX_BILL_BYTES,
): Promise<Blob> {
  for (const ratio of ratios) {
    let blob = await draw(ratio)
    if (!blob || blob.size < MIN_BILL_BYTES) blob = await draw(ratio)
    if (!blob || blob.size < MIN_BILL_BYTES) throw new Error('Could not draw the bill. Try again.')
    if (blob.size <= maxBytes) return blob
  }
  throw new Error(
    `This bill is too large to save (over ${Math.round(maxBytes / 1024)} KB). Use a smaller logo or QR image in Settings, or fewer lines.`,
  )
}
