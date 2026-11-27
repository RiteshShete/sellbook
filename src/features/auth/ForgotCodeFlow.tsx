import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, toast } from '../../components/ui'
import { toWaMeLink } from '../../lib/phone'
import { resetPasswordWithCode, sendRecoveryCode } from './authActions'
import { Captcha, captchaRequired } from './components/Captcha'
import { OtpInput } from './components/OtpInput'
import { isOtpComplete } from './otp'
import { ForgotSchema, NewPasswordSchema, validateForm } from './schemas'
import { useResendCountdown } from './useCountdown'
import { useAuth } from './useAuth'

/** Support number for people with no recovery email (public, set at build time). Empty: no link is shown. */
const SUPPORT_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) || ''

/**
 * Forgot password, by emailed 6-digit code: email -> code + new password -> signed in.
 * The wording never says whether the email is registered (the same sentence either way).
 */
export function ForgotCodeFlow({ doneTo }: { doneTo: string }) {
  const { client } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const secondsLeft = useResendCountdown(sentAt)

  const send = useMutation({
    mutationFn: (to: string) => sendRecoveryCode(client, to, captcha ?? undefined),
    onSuccess: () => setSentAt(Date.now()),
    // A check token works once: get a fresh one after every send, for the next send.
    onSettled: () => {
      setCaptcha(null)
      setAttempt((n) => n + 1)
    },
  })
  const reset = useMutation({
    mutationFn: (v: { code: string; password: string }) => resetPasswordWithCode(client, email.trim(), v.code, v.password),
    onSuccess: () => {
      toast.success('Password changed')
      navigate(doneTo, { replace: true })
    },
    onError: (e: Error) => setErrors({ code: e.message }),
  })

  function onSend(e: FormEvent) {
    e.preventDefault()
    const result = validateForm(ForgotSchema, { email })
    setErrors(result.ok ? {} : result.errors)
    if (!result.ok) return
    if (captchaRequired && !captcha) {
      setErrors({ captcha: 'Please complete the check first.' })
      return
    }
    send.mutate(result.value.email)
  }

  function onReset(e: FormEvent) {
    e.preventDefault()
    const pw = validateForm(NewPasswordSchema, { password })
    const next: Record<string, string> = pw.ok ? {} : pw.errors
    if (!isOtpComplete(code)) next.code = 'Enter all 6 digits.'
    setErrors(next)
    if (pw.ok && isOtpComplete(code)) reset.mutate({ code, password: pw.value.password })
  }

  const help = SUPPORT_WHATSAPP
    ? toWaMeLink(SUPPORT_WHATSAPP, 'Hello, I cannot reset my password and have no recovery email.')
    : null

  if (sentAt === null) {
    return (
      <form onSubmit={onSend} noValidate className="flex flex-col gap-4">
        <p className="text-muted">Enter the email you added to your account. We will send you a 6-digit code.</p>
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setErrors({})
          }}
          error={errors.email}
        />
        <Captcha key={attempt} onToken={setCaptcha} />
        {errors.captcha && <p role="alert" className="text-sm text-danger">{errors.captcha}</p>}
        <Button type="submit" block disabled={send.isPending}>
          {send.isPending ? 'Sending…' : 'Send code'}
        </Button>
        <p className="text-sm text-muted">
          No email on your account?{' '}
          {help ? (
            <a href={help} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">
              Contact support on WhatsApp
            </a>
          ) : (
            'Contact the shop or support to have it reset.'
          )}
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={onReset} noValidate className="flex flex-col gap-4">
      <p>
        If <span className="break-all font-medium">{email.trim()}</span> is registered, we sent a 6-digit code to it. Look
        in Spam too.
      </p>
      <OtpInput value={code} onChange={(c) => { setCode(c); setErrors({}) }} error={errors.code} autoFocus />
      <Input
        label="New password (at least 8 characters)"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value)
          setErrors((p) => ({ ...p, password: '' }))
        }}
        error={errors.password || undefined}
      />
      <Button type="submit" block disabled={reset.isPending}>
        {reset.isPending ? 'Changing…' : 'Change password'}
      </Button>
      <Captcha key={attempt} onToken={setCaptcha} />
      <Button
        variant="secondary"
        block
        disabled={secondsLeft > 0 || send.isPending || (captchaRequired && !captcha)}
        onClick={() => send.mutate(email.trim())}
      >
        {secondsLeft > 0 ? `Send the code again in ${secondsLeft}s` : 'Send the code again'}
      </Button>
      <button
        type="button"
        className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
        onClick={() => {
          setSentAt(null)
          setCode('')
        }}
      >
        Use a different email
      </button>
    </form>
  )
}
