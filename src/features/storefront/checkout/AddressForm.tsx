import { Input } from '../../../components/ui'
import { t } from '../i18n'
import type { AddressInput, CheckoutErrors } from './validate'

/** A new delivery address. Every field is a labelled input with its own message. */
export function AddressForm({ value, errors, onChange }: { value: AddressInput; errors: CheckoutErrors; onChange: (patch: Partial<AddressInput>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Input label={t('checkout.name')} autoComplete="name" value={value.name} onChange={(e) => onChange({ name: e.target.value })} error={errors.name} />
      <Input label={t('checkout.phone')} type="tel" inputMode="tel" autoComplete="tel" value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} error={errors.phone} />
      <Input label={t('checkout.line1')} autoComplete="address-line1" value={value.line1} onChange={(e) => onChange({ line1: e.target.value })} error={errors.line1} />
      <Input label={t('checkout.line2')} autoComplete="address-line2" value={value.line2} onChange={(e) => onChange({ line2: e.target.value })} />
      <Input label={t('checkout.landmark')} value={value.landmark} onChange={(e) => onChange({ landmark: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Input label={t('checkout.city')} autoComplete="address-level2" value={value.city} onChange={(e) => onChange({ city: e.target.value })} error={errors.city} />
        <Input label={t('checkout.pincode')} inputMode="numeric" autoComplete="postal-code" value={value.pincode} onChange={(e) => onChange({ pincode: e.target.value })} error={errors.pincode} />
      </div>
    </div>
  )
}
