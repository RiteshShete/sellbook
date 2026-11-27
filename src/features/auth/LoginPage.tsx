import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button, Input, Skeleton } from '../../components/ui'
import loginBg from '../../assets/login/login-bg.png'
import { RotatingArt } from './components/RotatingArt'
import { signInWithId } from './authActions'
import { Captcha, captchaRequired } from './components/Captcha'
import { GoogleButton } from './components/GoogleButton'
import { parseLoginId, type LoginId } from './loginId'
import type { LoginErrors } from './schemas'
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
  const { status, client } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const login = useMutation({
    mutationFn: (v: { id: LoginId; password: string }) => signInWithId(client, v.id, v.password, captcha ?? undefined),
    // A check token works once: get a fresh one after every try.
    onSettled: () => {
      setCaptcha(null)
      setAttempt((n) => n + 1)
    },
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
    // The first field takes an email or an Indian mobile number; its error key stays "email".
    const id = parseLoginId(email)
    const found: LoginErrors = {}
    if (!id) found.email = email.trim() ? 'Enter a valid email or mobile number' : 'Enter your email or mobile number'
    if (!password) found.password = 'Enter your password'
    if (captchaRequired && !captcha) found.captcha = 'Please complete the check first.'
    setErrors(found)
    if (id && password && (!captchaRequired || captcha)) login.mutate({ id, password })
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
            label="Email or mobile number"
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
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
          <Captcha key={attempt} onToken={setCaptcha} />
          {errors.captcha && (
            <p role="alert" className="text-sm text-white">
              {errors.captcha}
            </p>
          )}
          <Button type="submit" variant="lime" block disabled={login.isPending}>
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
          <GoogleButton returnTo="" />
          <div className="flex justify-between gap-4 text-sm font-medium text-white">
            <Link to="/signup" className="inline-flex min-h-11 items-center underline underline-offset-4">
              Create account
            </Link>
            <Link to="/forgot" className="inline-flex min-h-11 items-center underline underline-offset-4">
              Forgot password?
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}
