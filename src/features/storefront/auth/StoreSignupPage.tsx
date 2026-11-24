import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { Button, Input, Skeleton } from '../../../components/ui'
import { normalizePhone } from '../../../lib/phone'
import { queryKeys } from '../../../lib/queryKeys'
import { signUpWithId } from '../../auth/authActions'
import { Captcha, captchaRequired } from '../../auth/components/Captcha'
import { GoogleButton } from '../../auth/components/GoogleButton'
import { useMyContext } from '../../auth/myContext'
import { NewPasswordSchema, validateForm } from '../../auth/schemas'
import { useAuth } from '../../auth/useAuth'
import { StoreShell } from '../StorefrontLayout'
import { registerCustomer } from '../customerApi'
import { t } from '../i18n'
import { safeShopReturn, storefrontPath } from '../paths'

const link = 'font-medium underline underline-offset-4'

/**
 * Customer sign-up: name, mobile number, password, consent. The mobile number is the login (no SMS is sent, so it is not
 * verified). Also the "finish your details" screen for someone who is signed in but has no customer profile yet,
 * for example when the first attempt lost its connection half way.
 */
export function StoreSignupPage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { status, client } = useAuth()
  const ctx = useMyContext()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [accept, setAccept] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const finishing = status === 'signedIn'

  const submit = useMutation({
    mutationFn: async (v: { name: string; phone: string; password: string | null }) => {
      if (v.password !== null) {
        const { signedIn } = await signUpWithId(client, { kind: 'phone', phone: `+${v.phone}` }, v.password, captcha ?? undefined)
        if (!signedIn) throw new Error('Your account was created. Please sign in.')
      }
      await registerCustomer(client, { name: v.name, phone: v.phone })
      await queryClient.invalidateQueries({ queryKey: queryKeys.myContext })
    },
    onError: (e: Error) => setErrors({ form: e.message }),
  })

  const from: unknown = (location.state as { from?: unknown } | null)?.from
  if (finishing) {
    if (ctx.isPending) return <Skeleton className="m-6 h-40" />
    if (ctx.data && (ctx.data.has_customer_profile || ctx.data.is_owner)) {
      return <Navigate to={safeShopReturn(slug, from)} replace />
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const found: Record<string, string> = {}
    const digits = normalizePhone(phone)
    if (!name.trim()) found.name = t('signup.nameError')
    if (!digits) found.phone = t('signup.phoneError')
    let pw: string | null = null
    if (!finishing) {
      const checked = validateForm(NewPasswordSchema, { password })
      if (!checked.ok) found.password = checked.errors.password ?? ''
      else pw = checked.value.password
      if (!accept) found.accept = t('signup.consentError')
      if (captchaRequired && !captcha) found.captcha = 'Please complete the check first.'
    }
    setErrors(found)
    if (Object.keys(found).length === 0 && digits) submit.mutate({ name, phone: digits, password: pw })
  }

  const clear = () => setErrors({})
  return (
    <StoreShell title={finishing ? t('signup.finishTitle') : t('signup.title')}>
      <p className="text-muted">{finishing ? t('signup.finishIntro') : t('signup.intro', { shop: slug })}</p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label={t('signup.name')}
          autoComplete="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            clear()
          }}
          error={errors.name}
        />
        <Input
          label={t('signup.phone')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            clear()
          }}
          error={errors.phone}
        />
        {!finishing && (
          <>
            <Input
              label={t('signup.password')}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clear()
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
                    clear()
                  }}
                />
                <span className="text-sm">
                  {t('signup.consent')}{' '}
                  <Link to="/terms" target="_blank" rel="noreferrer" className={link}>
                    {t('terms.link')}
                  </Link>
                  {' · '}
                  <Link to="/privacy" target="_blank" rel="noreferrer" className={link}>
                    {t('privacy.link')}
                  </Link>
                </span>
              </label>
              {errors.accept && <p className="mt-1 text-sm text-danger">{errors.accept}</p>}
            </div>
            <Captcha onToken={setCaptcha} />
            {errors.captcha && <p role="alert" className="text-sm text-danger">{errors.captcha}</p>}
          </>
        )}
        {errors.form && (
          <p role="alert" className="text-sm text-danger">
            {errors.form}
          </p>
        )}
        <Button type="submit" block disabled={submit.isPending}>
          {submit.isPending ? t('signup.submitting') : finishing ? t('signup.finishSubmit') : t('signup.submit')}
        </Button>
        {!finishing && <GoogleButton returnTo={`${slug}/signup`} />}
        {!finishing && (
          <Link to={storefrontPath(slug, 'login')} state={{ from }} className={`inline-flex min-h-11 items-center ${link}`}>
            {t('signup.haveAccount')}
          </Link>
        )}
      </form>
    </StoreShell>
  )
}
