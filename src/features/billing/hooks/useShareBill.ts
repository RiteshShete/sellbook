import { useCallback } from 'react'
import { toast } from '../../../components/ui'
import { shareImage } from '../../../lib/share'

export interface ShareRequest {
  blob: Blob
  fileName: string
  title: string
  /** Message sent along with the image (amount + UPI link). */
  text?: string
}

/**
 * Share a ready Blob from a tap handler. Must not await anything before shareImage
 * (iOS drops the user gesture), so the blob has to be loaded already.
 */
export function useShareBill() {
  return useCallback(({ blob, fileName, title, text }: ShareRequest) => {
    shareImage(blob, fileName, title, text).then(
      (outcome) => {
        if (outcome === 'downloaded') {
          toast.info('Bill image saved. Attach it in WhatsApp from your photos or files.')
        }
      },
      (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not share the bill'),
    )
  }, [])
}
