import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BottomSheet } from '../../components/ui'
import { useAuth } from '../auth/useAuth'
import { usePlan } from '../plan/hooks/usePlan'
import { planChip } from '../plan/schemas'
import { AccountFooter, MoreLinks } from './MoreLinks'

/** The round button at the top right of the main screens: opens the account menu (plan, settings, trash, sign out...). */
export function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const { session } = useAuth()
  const plan = usePlan().data
  const letter = (session?.user.email ?? '?').charAt(0).toUpperCase()
  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-2 text-base font-semibold text-text active:bg-surface-strong"
      >
        {letter}
      </button>
      <BottomSheet open={open} onClose={close} title="Account">
        <div className="flex flex-col gap-4">
          {plan && (
            <Link
              to="/plan"
              onClick={close}
              className="flex min-h-11 items-center rounded-xl bg-surface-2 px-4 text-sm font-medium"
            >
              {planChip(plan)}
            </Link>
          )}
          <MoreLinks onNavigate={close} />
          <AccountFooter />
        </div>
      </BottomSheet>
    </>
  )
}
