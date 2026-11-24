import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button, Input, Skeleton, toast } from '../../components/ui'
import { signUpWithId } from './authActions'
import { GoogleButton } from './components/GoogleButton'
import { Captcha, captchaRequired } from './components/Captcha'
import { ForgotCodeFlow } from './ForgotCodeFlow'
import { parseLoginId, type LoginId } from './loginId'
import { NewPasswordSchema, validateForm } from './schemas'
import { useAuth } from './useAuth'

const link = 'font-medium underline underline-offset-4'

/** Per-field messages; typing in a field removes its message at once (as on the login page). */
function useFieldErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const clear = (field: string) =>
    setErrors((prev) =>
      field in prev ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== field)) : prev,
    )
  return { errors, setErrors, clear }
}

/** The plain page the account screens share: a title, the content, and the way back to sign-in. */
function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 py-[max(2rem,env(safe-area-inset-top))]">
      <h1 className="font-display text-3xl">{title}</h1>
      {children}
      <Link to="/login" className={`inline-flex min-h-11 items-center ${link}`}>
        Back to sign in
      </Link>
    </main>
  )
}

/**
 * New account: email or mobile number + password + accepting the terms. A mobile number is signed in at once and goes
 * on to set up the shop; an email gets a confirmation link first. The trial starts at sign-up.
 */
export function SignupPage() {
  const { status, client } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accept, setAccept] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const { errors, setErrors, clear } = useFieldErrors()
  const signup = useMutation({
    mutationFn: (v: { id: LoginId; password: string }) =>
      signUpWithId(client, v.id, v.password, captcha ?? undefined),
  })

  if (signup.isSuccess && signup.data.signedIn) return <Navigate to="/create-shop" replace />
  if (status === 'signedIn') return <Navigate to="/" replace />
  if (signup.isSuccess) {
    return (
      <AuthShell title="Check your email">
        <p>
          We sent a link to <span className="font-medium break-all">{signup.variables.id.kind === 'email' ? signup.variables.id.email : ''}</span>. Open it to
          start your free trial.
        </p>
        <p className="text-sm text-muted">
          It can take a minute; look in Spam too. If you already have an account with this email, no new
          email is sent: sign in instead.
        </p>
      </AuthShell>
    )
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const id = parseLoginId(email)
    const pw = validateForm(NewPasswordSchema, { password })
    const found: Record<string, string> = pw.ok ? {} : pw.errors
    if (!id) found.email = email.trim() ? 'Enter a valid email or mobile number' : 'Enter your email or mobile number'
    if (!accept) found.accept = 'Please accept the terms to continue'
    if (captchaRequired && !captcha) found.captcha = 'Please complete the check first.'
    setErrors(found)
    if (id && pw.ok && accept && (!captchaRequired || captcha)) signup.mutate({ id, password: pw.value.password })
  }

  return (
    <AuthShell title="Create your shop">
      <p className="text-muted">Free for 30 days. No payment details needed to start.</p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email or mobile number"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            clear('email')
          }}
          error={errors.email}
        />
        <Input
          label="Password (at least 8 characters)"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            clear('password')
          }}
          error={errors.password}
        />
        <div>
          <label className="flex min-h-11 items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0"
              checked={accept}
              onChange={(e) => {
            setAccept(e.target.checked)
            clear('accept')
          }}
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" target="_blank" rel="noreferrer" className={link}>
                Terms
              </Link>{' '}
              and the{' '}
              <Link to="/privacy" target="_blank" rel="noreferrer" className={link}>
                Privacy policy
              </Link>
              .
            </span>
          </label>
          {errors.accept && <p className="mt-1 text-sm text-danger">{errors.accept}</p>}
        </div>
        <Captcha onToken={setCaptcha} />
        {errors.captcha && <p role="alert" className="text-sm text-danger">{errors.captcha}</p>}
        <Button type="submit" block disabled={signup.isPending}>
          {signup.isPending ? 'Creating…' : 'Create account'}
        </Button>
        <GoogleButton returnTo="create-shop" />
      </form>
    </AuthShell>
  )
}

/** Forgot password: a 6-digit code is emailed (the same answer whether or not the account exists). */
export function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot password">
      <ForgotCodeFlow doneTo="/" />
    </AuthShell>
  )
}

/** Where the reset link lands. The link signs the owner in; without that session the link is old or used. */
export function ResetPasswordPage() {
  const { status, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const { errors, setErrors, clear } = useFieldErrors()
  const save = useMutation({
    mutationFn: (v: { password: string }) => updatePassword(v.password),
    onSuccess: () => {
      toast.success('Password changed')
      void navigate('/', { replace: true })
    },
  })

  if (status === 'loading') {
    return (
      <AuthShell title="New password">
        <div role="status" aria-label="Loading">
          <Skeleton className="h-24 w-full" />
        </div>
      </AuthShell>
    )
  }
  if (status === 'signedOut') {
    return (
      <AuthShell title="This link has expired">
        <p>A reset link works once and for a short time.</p>
        <Link to="/forgot" className={`inline-flex min-h-11 items-center ${link}`}>
          Send a new link
        </Link>
      </AuthShell>
    )
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateForm(NewPasswordSchema, { password })
    setErrors(result.ok ? {} : result.errors)
    if (result.ok) save.mutate(result.value)
  }

  return (
    <AuthShell title="New password">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="New password (at least 8 characters)"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            clear('password')
          }}
          error={errors.password}
        />
        <Button type="submit" block disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save password'}
        </Button>
      </form>
    </AuthShell>
  )
}
