import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { ErrorScreen } from './ErrorBoundary'

/** Router-level errorElement (failed lazy chunk, loader errors, render errors in a route). */
export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error'
  return <ErrorScreen message={message} />
}
