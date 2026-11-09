import { useState, type FormEvent } from 'react'
import { Button, Input, Textarea, toast } from '../../../components/ui'
import { useUpdateSettings } from '../hooks/useSettings'
import { UpiQrSection } from './UpiQrSection'
import {
  draftFromSettings,
  validateSettings,
  type Settings,
  type SettingsDraft,
  type SettingsErrors,
} from '../schemas'

export function ShopDetailsForm({ settings }: { settings: Settings }) {
  const [draft, setDraft] = useState<SettingsDraft>(() => draftFromSettings(settings))
  const [errors, setErrors] = useState<SettingsErrors>({})
  const update = useUpdateSettings()

  const field = (key: Exclude<keyof SettingsDraft, 'use_dynamic_qr'>) => ({
    value: draft[key],
    error: errors[key],
    onChange: (e: { target: { value: string } }) =>
      setDraft((d) => ({ ...d, [key]: e.target.value })),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateSettings(draft)
    setErrors(result.ok ? {} : result.errors)
    if (!result.ok) return
    update.mutate(
      { id: settings.id, patch: result.patch },
      { onSuccess: () => toast.success('Settings saved') },
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4"
    >
      <h2 className="font-semibold">Shop details (printed on bills)</h2>
      <Input label="Shop name" {...field('shop_name')} />
      <Textarea label="Address" {...field('shop_address')} />
      <Input label="Phone" type="tel" inputMode="tel" {...field('shop_phone')} />
      <Input
        label="UPI ID (optional)"
        autoCapitalize="none"
        placeholder="shop@okicici"
        {...field('upi_id')}
      />
      <Input
        label="Payee name (shown in the customer's UPI app)"
        autoComplete="organization"
        placeholder="Asha Cakes"
        maxLength={50}
        {...field('payee_name')}
      />
      <UpiQrSection
        upiId={draft.upi_id}
        payeeName={draft.payee_name}
        useDynamic={draft.use_dynamic_qr}
        hasUploadedQr={settings.qr_path !== null}
        onToggle={(on) => setDraft((d) => ({ ...d, use_dynamic_qr: on }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Bill prefix" autoCapitalize="characters" {...field('bill_prefix')} />
        <Input
          label="Next bill no."
          value={String(settings.next_bill_no)}
          readOnly
          disabled
          title="Assigned automatically; never reused"
        />
      </div>
      <Textarea
        label="Bill footer (optional)"
        placeholder="e.g. GSTIN, thank-you note"
        rows={2}
        {...field('bill_footer')}
      />
      <Button type="submit" block disabled={update.isPending}>
        {update.isPending ? 'Saving…' : 'Save details'}
      </Button>
    </form>
  )
}
