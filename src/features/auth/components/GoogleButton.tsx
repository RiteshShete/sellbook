import { useMutation } from '@tanstack/react-query'
import { Button } from '../../../components/ui'
import { useAuth } from '../useAuth'

/** Switched on by the owner once the Google client exists (README / GO_LIVE_RUNBOOK): until then nothing is shown. */
export const googleLoginEnabled = import.meta.env.VITE_GOOGLE_LOGIN_ENABLED === 'true'

/** The page to come back to after Google, as an absolute address under this app's base path. */
export const returnUrl = (path: string): string => new URL(import.meta.env.BASE_URL + path.replace(/^\//, ''), window.location.origin).toString()

/**
 * "Continue with Google". Google only proves who the person is: a shop owner still creates a shop, and a customer still
 * gives a name and mobile number (the finish step), exactly like an email sign-up. `returnTo` is a path inside this app.
 */
export function GoogleButton({ returnTo }: { returnTo: string }) {
  const { client } = useAuth()
  const go = useMutation({
    mutationFn: async () => {
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnUrl(returnTo) } })
      if (error) throw error
    },
  })
  if (!googleLoginEnabled) return null
  return (
    <Button type="button" variant="secondary" block disabled={go.isPending} onClick={() => go.mutate()}>
      {go.isPending ? 'Opening Google...' : 'Continue with Google'}
    </Button>
  )
}
