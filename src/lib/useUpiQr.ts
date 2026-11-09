import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'
import { upiQrDataUrl } from './qrImage'

/** The QR image for a UPI link (null link = nothing to draw). Cached: the same link is the same image. */
export function useUpiQr(uri: string | null) {
  return useQuery({
    queryKey: queryKeys.upiQr(uri ?? ''),
    // enabled guards the null case.
    queryFn: () => upiQrDataUrl(uri ?? ''),
    enabled: uri !== null,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  })
}
