import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Skeleton } from '../../components/ui'
import { useAuth } from './useAuth'

/** Route guard: nothing renders until a session is known; signed-out users go to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-3 p-4" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <>{children}</>
}
