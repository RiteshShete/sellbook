import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { Button, ConfirmDialog, Skeleton, toast } from '../../../components/ui'
import { ChangePasswordCard } from '../../auth/ChangePasswordCard'
import { RecoveryEmailBanner, RecoveryEmailCard } from '../../auth/RecoveryEmail'
import { useAuth } from '../../auth/useAuth'
import { AccountDetails } from './AccountDetails'
import { SavedAddresses } from './SavedAddresses'
import { StoreShell } from '../StorefrontLayout'
import { fetchCustomerProfile, requestAccountDeletion } from '../customerApi'
import { t } from '../i18n'
import { storefrontPath } from '../paths'

/** The customer's own details, recovery email, password and the "delete my account" request. */
export function StoreAccountPage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const { status, client, signOut } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const profile = useQuery({
    queryKey: ['customerProfile'],
    queryFn: () => fetchCustomerProfile(client),
    enabled: status === 'signedIn',
  })
  const out = useMutation({ mutationFn: signOut })
  const del = useMutation({
    mutationFn: () => requestAccountDeletion(client),
    onSuccess: () => {
      setConfirming(false)
      toast.success(t('account.deleteDone'))
    },
  })

  if (status === 'loading') return <Skeleton className="m-6 h-40" />
  if (status === 'signedOut') {
    return <Navigate to={storefrontPath(slug, 'login')} replace state={{ from: location.pathname }} />
  }

  return (
    <>
      <RecoveryEmailBanner to={storefrontPath(slug, 'account')} />
      <StoreShell title={t('account.title')}>
        {profile.isPending ? (
          <Skeleton className="h-16" />
        ) : profile.data ? (
          <AccountDetails profile={profile.data} />
        ) : null}
        <SavedAddresses />
        <RecoveryEmailCard />
        <ChangePasswordCard />
        <Button variant="secondary" block disabled={out.isPending} onClick={() => out.mutate()}>
          {out.isPending ? t('account.signingOut') : t('account.signOut')}
        </Button>
        <button type="button" className="min-h-11 text-sm text-danger-ink underline underline-offset-4" onClick={() => setConfirming(true)}>
          {t('account.delete')}
        </button>
        <ConfirmDialog
          open={confirming}
          title={t('account.deleteTitle')}
          message={t('account.deleteBody')}
          confirmLabel={t('account.deleteConfirm')}
          destructive
          busy={del.isPending}
          onConfirm={() => del.mutate()}
          onCancel={() => setConfirming(false)}
        />
      </StoreShell>
    </>
  )
}
