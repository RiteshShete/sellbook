import { Page } from '../../app/Page'
import { ChangePasswordCard } from './ChangePasswordCard'
import { RecoveryEmailCard } from './RecoveryEmail'
import { useAuth } from './useAuth'

/** Owner: sign-in details. The recovery email is what lets a forgotten password be reset by code. */
export function OwnerAccountPage() {
  const { session } = useAuth()
  const who = session?.user.email || (session?.user.phone ? `+${session.user.phone.replace(/^\+/, '')}` : '')
  return (
    <Page title="Account & security" back="/more">
      <div className="flex flex-col gap-4">
        {who && <p className="break-all text-sm text-muted">Signed in as {who}</p>}
        <RecoveryEmailCard />
        <ChangePasswordCard />
      </div>
    </Page>
  )
}
