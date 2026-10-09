import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Button, Input, Skeleton, toast } from '../../components/ui'
import { validateLogin, type LoginErrors } from './schemas'
import { useAuth } from './useAuth'

/** Only allow in-app paths as a post-login target (no open redirects). */
function safeTarget(from: unknown): string {
  return typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    from !== '/login'
    ? from
    : '/orders'
}

export function LoginPage() {
  const { status, signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})

  const login = useMutation({
    mutationFn: (v: { email: string; password: string }) => signIn(v.email, v.password),
    onError: (e: Error) => toast.error(e.message),
  })

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-sm p-6" role="status" aria-label="Loading">
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }
  if (status === 'signedIn') {
    const from: unknown = (location.state as { from?: unknown } | null)?.from
    return <Navigate to={safeTarget(from)} replace />
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateLogin({ email, password })
    setErrors(result.ok ? {} : result.errors)
    if (result.ok) login.mutate(result.value)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <div>
        <h1 className="font-display text-5xl tracking-tight">Sellbook</h1>
        <p className="text-muted">Owner sign-in</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Button type="submit" block disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  )
}
