import { useMutation } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui'
import { useIsAdmin } from '../admin/useAdmin'
import { useMyContext } from '../auth/myContext'
import { useAuth } from '../auth/useAuth'

const LINKS = [
  { to: '/plan', label: 'Your plan' },
  { to: '/more/shop', label: 'Online shop' },
  { to: '/pricing', label: 'Prices & offers' },
  { to: '/account', label: 'Account & security' },
  { to: '/analytics', label: 'Pending payments' },
  { to: '/settings', label: 'Settings' },
  { to: '/trash', label: 'Trash' },
  { to: '/activity', label: 'Activity' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
]

/** The account and set-up links, one list for the More page and the profile menu. */
export function MoreLinks({ onNavigate }: { onNavigate?: () => void }) {
  // Only the platform admin has this link (and the server only answers them).
  const isAdmin = useIsAdmin().data
  // An account with no online shop yet is offered the set-up screen (it needs an invite code).
  const noShop = useMyContext().data?.is_owner === false
  const links = [
    ...LINKS,
    ...(noShop ? [{ to: '/create-shop', label: 'Set up your online shop' }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
  ]
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {links.map((l) => (
        <li key={l.to}>
          <Link to={l.to} onClick={onNavigate} className="flex min-h-14 items-center justify-between px-4">
            <span>{l.label}</span>
            <ChevronRight className="h-5 w-5 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Who is signed in, Sign out, and the app version. */
export function AccountFooter() {
  const { session, signOut } = useAuth()
  const logout = useMutation({ mutationFn: signOut })
  return (
    <>
      <div className="mt-6 flex flex-col gap-2">
        {session?.user.email && <p className="truncate text-sm text-muted">Signed in as {session.user.email}</p>}
        <Button variant="secondary" block disabled={logout.isPending} onClick={() => logout.mutate()}>
          {logout.isPending ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
      <p className="mt-6 text-center text-xs text-muted">Version {__APP_VERSION__}</p>
    </>
  )
}
