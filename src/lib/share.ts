export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded'

/** Whether the phone's share sheet can take this file (iOS 15+, Android Chrome; not desktop Firefox). */
export function canShareFile(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

/** Saves the blob through a temporary <a download> link. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser time to start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Opens the share sheet with an image, or downloads it where file sharing is unsupported.
 * Call it directly from a tap handler with an already-built Blob: iOS needs the user gesture,
 * so nothing slow may be awaited before navigator.share. Closing the sheet is 'cancelled',
 * not an error.
 */
export async function shareImage(
  blob: Blob,
  fileName: string,
  title: string,
  text?: string,
): Promise<ShareOutcome> {
  const file = new File([blob], fileName, { type: blob.type || 'image/png' })
  if (!canShareFile(file)) {
    downloadBlob(blob, fileName)
    return 'downloaded'
  }
  try {
    // Some WhatsApp builds keep only the image or only the text when both are sent; the
    // bill card therefore also offers the message on its own (wa.me link).
    await navigator.share(text ? { files: [file], title, text } : { files: [file], title })
    return 'shared'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    throw e
  }
}
