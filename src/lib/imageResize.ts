/**
 * Product and logo pictures are made small IN THE BROWSER (the free plan has no image transformation): one full size
 * (at most 1000 px, aiming for 60-120 KB, never above 300 KB) and one thumbnail (400 px, about 20-30 KB).
 */
export interface ResizeSpec {
  /** Longest side in pixels. */
  edge: number
  /** The encoder starts at high quality and steps down until the picture is under this many bytes. */
  cap: number
}

export const FULL_SIZE: ResizeSpec = { edge: 1000, cap: 300_000 }
export const THUMB_SIZE: ResizeSpec = { edge: 400, cap: 80_000 }
export const LOGO_SIZE: ResizeSpec = { edge: 400, cap: 150_000 }
/** A phone photo can be big; refuse only the absurd before decoding it. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024

/** Scales to fit inside edge x edge; never makes a small picture bigger. */
export function fitWithin(width: number, height: number, edge: number): { width: number; height: number } {
  const scale = Math.min(1, edge / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5, 0.4, 0.3]

/** Tries each quality in turn and returns the first result under the cap; throws if even the lowest is too big. */
export async function encodeUnderCap(encode: (quality: number) => Promise<Blob>, cap: number): Promise<Blob> {
  for (const q of QUALITY_STEPS) {
    const blob = await encode(q)
    if (blob.size <= cap) return blob
  }
  throw new Error('This picture is too detailed to shrink enough. Try another one.')
}

/** "a/b/uuid.webp" -> "a/b/uuid_t.webp": the thumbnail lives next to the full size, found by name. */
export const thumbPath = (path: string): string => path.replace(/(\.[a-z0-9]+)$/i, '_t$1')

export function fileExtension(type: string): 'webp' | 'jpg' {
  return type === 'image/webp' ? 'webp' : 'jpg'
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the picture.'))), type, quality),
  )
}

/** Decodes the chosen file (turning a phone photo the right way up), draws it at the target size and encodes it. */
export async function resizeImage(file: File, spec: ResizeSpec): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('That photo is too large. Choose one under 25 MB.')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('This picture could not be opened. Try a JPEG or PNG photo.')
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, spec.edge)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process the picture.')
    ctx.drawImage(bitmap, 0, 0, width, height)
    // WebP where the browser can write it (the type comes back as PNG when it cannot), else JPEG.
    const probe = await canvasBlob(canvas, 'image/webp', 0.8)
    const type = probe.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
    return await encodeUnderCap((q) => canvasBlob(canvas, type, q), spec.cap)
  } finally {
    bitmap.close()
  }
}
