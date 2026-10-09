import { Toaster as SonnerToaster, toast } from 'sonner'

/** Mount once at the app root. Errors surface through `toast.error(...)`. */
export function Toast() {
  return (
    <SonnerToaster
      position="top-center"
      theme="light"
      offset={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}
      closeButton
    />
  )
}

export { toast }
