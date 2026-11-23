import { t } from '../i18n'
import type { z } from 'zod'
import type { AddressRowSchema } from '../contract'

type Saved = z.infer<typeof AddressRowSchema>

const line = (a: Saved) => [a.line1, a.line2, a.area, a.city, a.pincode].filter(Boolean).join(', ')

/** Saved addresses as radio buttons, plus "use a new address" (null). */
export function AddressPicker({ saved, value, onChange }: { saved: Saved[]; value: string | null; onChange: (id: string | null) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-muted">{t('checkout.savedAddresses')}</legend>
      {saved.map((a) => (
        <label key={a.id} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${value === a.id ? 'border-text bg-surface-2' : 'border-border-strong bg-surface'}`}>
          <input type="radio" name="address" className="mt-1 h-5 w-5" checked={value === a.id} onChange={() => onChange(a.id)} />
          <span className="min-w-0 break-words">
            <span className="font-medium">{a.name}</span>
            <span className="block text-sm text-muted">{line(a)}</span>
          </span>
        </label>
      ))}
      <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 ${value === null ? 'border-text bg-surface-2' : 'border-border-strong bg-surface'}`}>
        <input type="radio" name="address" className="h-5 w-5" checked={value === null} onChange={() => onChange(null)} />
        {t('checkout.newAddress')}
      </label>
    </fieldset>
  )
}
