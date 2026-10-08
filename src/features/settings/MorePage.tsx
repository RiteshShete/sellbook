import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Page } from '../../app/Page'

const LINKS = [
  { to: '/settings', label: 'Settings' },
  { to: '/trash', label: 'Trash' },
]

export function MorePage() {
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
    </Page>
  )
}
