import { toast } from '../components/ui'
import { errorMessage } from '../lib/dbError'

/**
 * Last-resort handlers for errors no component caught: a rejected promise nobody awaited, or an error
 * thrown outside React rendering (the ErrorBoundary only covers rendering). Each is logged and shown as a
 * toast so the owner sees something instead of a silently broken screen.
 * Returns a function that removes the listeners.
 */
export function installGlobalErrorHandlers(target: Window = window): () => void {
  const onRejection = (event: PromiseRejectionEvent) => {
    console.error('Unhandled promise rejection', event.reason)
    toast.error(errorMessage(event.reason))
  }
  const onError = (event: ErrorEvent) => {
    console.error('Uncaught error', event.error ?? event.message)
    toast.error(errorMessage(event.error ?? event.message))
  }
  target.addEventListener('unhandledrejection', onRejection)
  target.addEventListener('error', onError)
  return () => {
    target.removeEventListener('unhandledrejection', onRejection)
    target.removeEventListener('error', onError)
  }
}
