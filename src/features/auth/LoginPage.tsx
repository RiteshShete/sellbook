import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Button, Input, Skeleton } from '../../components/ui'
import loginBg from '../../assets/login/login-bg.png'
import { RotatingArt } from './components/RotatingArt'
import { validateLogin, type LoginErrors } from './schemas'
import { useAuth } from './useAuth'

/** Only allow in-app paths as a post-login target (no open redirects). */
function safeTarget(from: unknown): string {
  return typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    from !== '/login'
    ? from
    : '/'
}

export function LoginPage() {
  const { status, signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})

  const login = useMutation({
    mutationFn: (v: { email: string; password: string }) => signIn(v.email, v.password),
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

  /** Typing in a field removes its error at once; Sign in re-validates and shows it again if needed. */
  function clearError(field: keyof LoginErrors) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateLogin({ email, password })
    setErrors(result.ok ? {} : result.errors)
    if (result.ok) login.mutate(result.value)
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-login-from to-login-to">
      {/* Figma: photo is 470x940, centred, starting 114px above the top. Grows only to keep covering. */}
      <img
        src={loginBg}
        alt=""
        aria-hidden
        className="pointer-events-none absolute top-[-114px] left-1/2 h-[max(940px,calc(100%+114px))] w-[max(470px,100%)] max-w-none -translate-x-1/2 object-cover"
      />
      <main className="relative mx-auto flex min-h-dvh max-w-sm flex-col justify-end gap-6 px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(5rem,env(safe-area-inset-bottom))]">
        <RotatingArt />
        <h1 className="font-display text-5xl tracking-tight text-white">Sellbook</h1>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Input
            onImage
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              clearError('email')
            }}
            error={errors.email}
          />
          <Input
            onImage
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              clearError('password')
            }}
            error={errors.password}
          />
          <Button type="submit" variant="lime" block disabled={login.isPending}>
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </main>
    </div>
  )
}
