import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BottomSheet, Button, Input, toast } from '../../../components/ui'
import { normalizePhone, toNationalPhone } from '../../../lib/phone'
import { useAuth } from '../../auth/useAuth'
import { updateMyProfile, type CustomerProfile } from '../customerApi'
import { t } from '../i18n'

/** Name and mobile, with an Edit sheet. The server refuses a number the account signs in with. */
export function AccountDetails({ profile }: { profile: CustomerProfile }) {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(toNationalPhone(profile.phone))
  const national = normalizePhone(phone)
  const save = useMutation({
    mutationFn: () => updateMyProfile(client, { name, phone: national ?? '' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['customerProfile'] })
      setOpen(false)
      toast.success(t('account.saved'))
    },
  })
  const nameOk = name.trim().length > 0 && name.trim().length <= 100

  return (
    <>
      <dl className="rounded-2xl border border-border bg-surface p-4">
        <dt className="text-sm text-muted">{t('account.name')}</dt>
        <dd className="mb-2 font-medium">{profile.name}</dd>
        <dt className="text-sm text-muted">{t('account.phone')}</dt>
        <dd className="font-medium">+{profile.phone}</dd>
        <Button variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
          {t('account.edit')}
        </Button>
      </dl>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('account.editTitle')}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (nameOk && national) save.mutate()
          }}
        >
          <Input label={t('account.name')} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={nameOk ? undefined : 'Enter your name'} />
          <Input label={t('account.phone')} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={national ? undefined : 'Enter a valid 10-digit mobile number'} />
          <Button type="submit" block disabled={!nameOk || !national || save.isPending}>
            {t('account.save')}
          </Button>
        </form>
      </BottomSheet>
    </>
  )
}
