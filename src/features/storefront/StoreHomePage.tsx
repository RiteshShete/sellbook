import { Link, useParams } from 'react-router-dom'
import { StoreShell } from './StorefrontLayout'
import { storefrontPath } from './paths'

/** Placeholder landing page for a shop until the catalogue is built (S4). Reached after sign-up and sign-in. */
export function StoreHomePage() {
  const { slug = '' } = useParams()
  return (
    <StoreShell title={slug}>
      <p className="text-muted">The shop page is coming soon.</p>
      <Link to={storefrontPath(slug, 'account')} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">
        Your account
      </Link>
    </StoreShell>
  )
}
