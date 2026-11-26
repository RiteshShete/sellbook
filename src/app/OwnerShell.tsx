import { RequireAuth } from '../features/auth/RequireAuth'
import { RequireOwner } from '../features/auth/RequireOwner'
import { AppLayout } from './AppLayout'

/**
 * The owner app's frame: sign-in guard, owner guard, tab bar, plan banners. It is loaded on demand (the router imports
 * it lazily), so a shop visitor never downloads any of it (STOREFRONT_PLAN 9.5 bundle budget).
 */
export function OwnerShell() {
  return (
    <RequireAuth>
      <RequireOwner>
        <AppLayout />
      </RequireOwner>
    </RequireAuth>
  )
}
