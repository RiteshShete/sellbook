import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui'
import { Page } from './Page'

export function NotFoundPage() {
  return (
    <Page title="Not found">
      <EmptyState
        title="Page not found"
        description="That address doesn't exist."
        action={
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-fg"
          >
            Go to Orders
          </Link>
        }
      />
    </Page>
  )
}
