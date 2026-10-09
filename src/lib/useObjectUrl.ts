import { useEffect, useState } from 'react'

/**
 * An object URL for a Blob, revoked when the blob changes or the component unmounts. Created
 * inside the effect (not useMemo) so StrictMode's mount-cleanup-mount never leaves a revoked URL.
 */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [entry, setEntry] = useState<{ blob: Blob; url: string }>()
  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    // The URL is an external resource owned by this effect, so it has to be created here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntry({ blob, url })
    return () => URL.revokeObjectURL(url)
  }, [blob])
  // Only hand out the URL that belongs to the current blob (none while the next one is made).
  return entry && entry.blob === blob ? entry.url : undefined
}
