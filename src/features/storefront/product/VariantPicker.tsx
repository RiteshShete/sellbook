import { formatINR } from '../../../lib/money'
import { variantLabel } from '../../../lib/variants'
import { t } from '../i18n'
import type { StoreVariant } from '../types'

/** Choose one variant: a radio group of big targets, each with its price (the normal price struck through on an offer). */
export function VariantPicker({ variants, value, onChange }: { variants: StoreVariant[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-muted">{t('product.chooseOption')}</legend>
      {variants.map((v) => {
        const on = v.effective_price < v.price
        return (
          <label key={v.id} className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 ${value === v.id ? 'border-text bg-surface-2' : 'border-border-strong bg-surface'}`}>
            <span className="flex items-center gap-3">
              <input type="radio" name="variant" className="h-5 w-5" checked={value === v.id} onChange={() => onChange(v.id)} />
              <span>{variantLabel(v)}</span>
            </span>
            <span className="text-right">
              {on && <s className="mr-2 text-sm text-muted">{formatINR(v.price)}</s>}
              <span className="font-medium">{formatINR(v.effective_price)}</span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
