import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BottomSheet, Button, ConfirmDialog, toast } from '../../../components/ui'
import { queryKeys } from '../../../lib/queryKeys'
import { normalizePhone, toNationalPhone } from '../../../lib/phone'
import { useAuth } from '../../auth/useAuth'
import { deleteAddress, saveAddress } from '../api/storefrontApi'
import { AddressForm } from '../checkout/AddressForm'
import { hasErrors, validateAddress, type AddressInput } from '../checkout/validate'
import { LIMITS } from '../contract'
import { useAddresses } from '../hooks/useStore'
import { t } from '../i18n'

type Editing = { id?: string; value: AddressInput } | null
const blank: AddressInput = { name: '', phone: '', line1: '', line2: '', area: '', city: '', pincode: '', landmark: '' }

/** Saved delivery addresses: add, edit, delete. Past orders keep the address they were delivered to. */
export function SavedAddresses() {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  const saved = useAddresses()
  const [editing, setEditing] = useState<Editing>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const errors = editing && shown ? validateAddress(editing.value) : {}
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.store.addresses })

  const save = useMutation({
    mutationFn: (e: NonNullable<Editing>) => saveAddress(client, { ...e.value, id: e.id, phone: normalizePhone(e.value.phone) ?? '' }),
    onSuccess: async () => {
      await refresh()
      setEditing(null)
      toast.success(t('account.saved'))
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteAddress(client, id),
    onSuccess: async () => {
      await refresh()
      setRemoving(null)
    },
  })
  const rows = saved.data ?? []
  const full = rows.length >= LIMITS.maxAddresses
  const open = (e: Editing) => {
    setShown(false)
    setEditing(e)
  }

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4" aria-labelledby="addr-h">
      <h2 id="addr-h" className="font-display text-lg">{t('account.addresses')}</h2>
      {rows.length === 0 && <p className="text-sm text-muted">{t('account.noAddresses')}</p>}
      {rows.map((a) => (
        <div key={a.id} className="flex items-start justify-between gap-3 border-t border-border pt-2">
          <p className="min-w-0 break-words text-sm">
            <span className="font-medium">{a.name}</span>
            <br />
            {[a.line1, a.line2, a.area, a.city, a.pincode].filter(Boolean).join(', ')}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={() => open({ id: a.id, value: { name: a.name, phone: toNationalPhone(a.phone), line1: a.line1, line2: a.line2 ?? '', area: a.area ?? '', city: a.city, pincode: a.pincode, landmark: a.landmark ?? '' } })}>
              {t('account.edit')}
            </Button>
            <Button variant="secondary" onClick={() => setRemoving(a.id)}>{t('account.deleteAddress')}</Button>
          </div>
        </div>
      ))}
      {full ? <p className="text-sm text-muted">{t('account.addressLimit', { n: LIMITS.maxAddresses })}</p> : <Button variant="secondary" onClick={() => open({ value: blank })}>{t('account.addAddress')}</Button>}
      <BottomSheet open={editing !== null} onClose={() => setEditing(null)} title={t('account.addressTitle')}>
        {editing && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              setShown(true)
              if (!hasErrors(validateAddress(editing.value))) save.mutate(editing)
            }}
          >
            <AddressForm value={editing.value} errors={errors} onChange={(patch) => setEditing({ ...editing, value: { ...editing.value, ...patch } })} />
            <Button type="submit" block disabled={save.isPending}>{t('account.save')}</Button>
          </form>
        )}
      </BottomSheet>
      <ConfirmDialog open={removing !== null} title={t('account.deleteAddressTitle')} message={t('account.deleteAddressBody')} confirmLabel={t('account.deleteAddress')} destructive busy={remove.isPending} onConfirm={() => removing && remove.mutate(removing)} onCancel={() => setRemoving(null)} />
    </section>
  )
}
