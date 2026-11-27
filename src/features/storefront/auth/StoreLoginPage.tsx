import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { Button, Input, Skeleton } from '../../../components/ui'
import { signInWithId } from '../../auth/authActions'
import { Captcha, captchaRequired } from '../../auth/components/Captcha'
import { GoogleButton } from '../../auth/components/GoogleButton'
import { parseLoginId, type LoginId } from '../../auth/loginId'
import { useMyContext } from '../../auth/myContext'
import { useAuth } from '../../auth/useAuth'
import { StoreShell } from '../StorefrontLayout'
import { t } from '../i18n'
import { safeShopReturn, storefrontPath } from '../paths'

const link = 'inline-flex min-h-11 items-center font-medium underline underline-offset-4'

/** Customer sign-in: mobile number or email, then back to where they were (only ever a page of THIS shop). */
export function StoreLoginPage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const { status, client } = useAuth()
  const ctx = useMyContext()
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
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

  const from: unknown = (location.state as { from?: unknown } | null)?.from
  if (status === 'signedIn') {
    if (ctx.isPending) return <Skeleton className="m-6 h-40" />
    // Signed up but never gave a name and number: finish that first.
    if (ctx.data && !ctx.data.has_customer_profile && !ctx.data.is_owner) {
      return <Navigate to={storefrontPath(slug, 'signup')} replace state={{ from }} />
    }
    return <Navigate to={safeShopReturn(slug, from)} replace />
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseLoginId(id)
    const found: Record<string, string> = {}
    if (!parsed) found.id = t('login.idError')
    if (!password) found.password = t('login.passwordError')
    if (captchaRequired && !captcha) found.captcha = 'Please complete the check first.'
    setErrors(found)
    if (parsed && password && (!captchaRequired || captcha)) login.mutate({ id: parsed, password })
  }

  return (
    <StoreShell title={t('login.title')}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label={t('login.id')}
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          value={id}
          onChange={(e) => {
            setId(e.target.value)
            setErrors({})
          }}
          error={errors.id}
        />
        <Input
          label={t('login.password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setErrors({})
          }}
          error={errors.password}
        />
        <Captcha key={attempt} onToken={setCaptcha} />
        {errors.captcha && (
          <p role="alert" className="text-sm text-danger">
            {errors.captcha}
          </p>
        )}
        <Button type="submit" block disabled={login.isPending}>
          {login.isPending ? t('login.submitting') : t('login.submit')}
        </Button>
        <GoogleButton returnTo={`${slug}/login`} />
        <div className="flex justify-between gap-4 text-sm">
          <Link to={storefrontPath(slug, 'signup')} state={{ from }} className={link}>
            {t('login.noAccount')}
          </Link>
          <Link to={storefrontPath(slug, 'forgot')} className={link}>
            {t('login.forgot')}
          </Link>
        </div>
      </form>
    </StoreShell>
  )
}
