import { useMutation } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Page } from '../../app/Page'
import { Button } from '../../components/ui'
import { useAuth } from '../auth/useAuth'

const LINKS = [
  { to: '/pending', label: 'Pending payments' },
  { to: '/settings', label: 'Settings' },
  { to: '/trash', label: 'Trash' },
  { to: '/activity', label: 'Activity' },
]

export function MorePage() {
  const { session, signOut } = useAuth()
  const logout = useMutation({
    mutationFn: signOut,
  })

  return (
    <Page title="More">
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {LINKS.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="flex min-h-14 items-center justify-between px-4">
              <span>{l.label}</span>
              <ChevronRight className="h-5 w-5 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-2">
        {session?.user.email && (
          <p className="truncate text-sm text-muted">Signed in as {session.user.email}</p>
        )}
        <Button
          variant="secondary"
          block
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          {logout.isPending ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </Page>
  )
}
