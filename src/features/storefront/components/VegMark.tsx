import { t } from '../i18n'
import type { StoreProduct } from '../types'

const LOOK: Record<NonNullable<StoreProduct['veg_type']>, { box: string; dot: string; text: Parameters<typeof t>[0] }> = {
  veg: { box: 'border-success text-success-ink', dot: 'bg-success', text: 'product.veg' },
  non_veg: { box: 'border-danger text-danger-ink', dot: 'bg-danger', text: 'product.nonVeg' },
  egg: { box: 'border-border-strong text-muted', dot: 'bg-muted', text: 'product.egg' },
}

/** The veg / non-veg mark: an icon AND words (colour alone is not enough). */
export function VegMark({ type, showText = false }: { type: StoreProduct['veg_type']; showText?: boolean }) {
  if (!type) return null
  const look = LOOK[type]
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${look.box.split(' ')[1]}`}>
      <span aria-hidden className={`grid h-4 w-4 place-items-center rounded-sm border ${look.box.split(' ')[0]}`}>
        <span className={`h-2 w-2 rounded-full ${look.dot}`} />
      </span>
      <span className={showText ? '' : 'sr-only'}>{t(look.text)}</span>
    </span>
  )
}
