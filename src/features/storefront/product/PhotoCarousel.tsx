import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { imageUrl } from '../api/storefrontApi'
import { t } from '../i18n'

/** Up to 5 pictures, with previous / next BUTTONS (swiping alone would exclude people who cannot swipe). */
export function PhotoCarousel({ paths, name }: { paths: string[]; name: string }) {
  const { client } = useAuth()
  const [i, setI] = useState(0)
  if (paths.length === 0) return <div className="aspect-square w-full rounded-2xl bg-surface-2" aria-hidden />
  const at = Math.min(i, paths.length - 1)
  const go = (by: number) => setI((at + by + paths.length) % paths.length)
  return (
    <div className="relative" role="group" aria-roledescription="carousel" aria-label={name}>
      <img
        src={imageUrl(client, paths[at] ?? '')}
        alt={t('product.pictureOf', { n: at + 1, total: paths.length })}
        width={1000}
        height={1000}
        className="aspect-square w-full rounded-2xl border border-border object-cover"
      />
      {paths.length > 1 && (
        <>
          <button type="button" aria-label={t('product.prevPicture')} onClick={() => go(-1)} className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-surface/90">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" aria-label={t('product.nextPicture')} onClick={() => go(1)} className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-surface/90">
            <ChevronRight className="h-5 w-5" />
          </button>
          <p className="absolute bottom-2 right-2 rounded-full bg-surface/90 px-2 py-0.5 text-xs" aria-live="polite">
            {at + 1} / {paths.length}
          </p>
        </>
      )}
    </div>
  )
}
