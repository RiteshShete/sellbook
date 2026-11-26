import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, toast } from '../../components/ui'
import { queryKeys } from '../../lib/queryKeys'
import { addRecoveryEmail, confirmRecoveryEmail } from './authActions'
import { OtpInput } from './components/OtpInput'
import { isOtpComplete } from './otp'
import { ForgotSchema, readableAuthError, validateForm } from './schemas'
import { useResendCountdown } from './useCountdown'
import { useAuth } from './useAuth'

/** The signed-in account's email, and whether it is confirmed (a confirmed email is what lets a password be reset). */
export function useAuthUser() {
  const { client, session } = useAuth()
  return useQuery({
    queryKey: [...queryKeys.authUser, session?.user.id ?? null],
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await client.auth.getUser()
      if (error) throw new Error(readableAuthError(error.message, error.code))
      const user = data.user
      return { email: user?.email || null, verified: Boolean(user?.email && user.email_confirmed_at) }
    },
  })
}

/** A nudge on every owner screen and on the customer account until a recovery email is confirmed. */
export function RecoveryEmailBanner({ to }: { to: string }) {
  const user = useAuthUser()
  if (!user.data || user.data.verified) return null
  return (
    <div role="status" className="border-b border-border bg-surface-2 px-4 py-2 text-sm">
      Add and confirm an email so you can reset your password.{' '}
      <Link to={to} className="font-medium underline underline-offset-4">
        Add email
      </Link>
    </div>
  )
}

/** Add an email, type the 6-digit code that arrives, done. Also resends the code (after 60 seconds). */
export function RecoveryEmailCard() {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  const user = useAuthUser()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [problem, setProblem] = useState<string | undefined>()
  const [sentAt, setSentAt] = useState<number | null>(null)
  const secondsLeft = useResendCountdown(sentAt)

  const send = useMutation({
    mutationFn: (to: string) => addRecoveryEmail(client, to),
    onSuccess: () => setSentAt(Date.now()),
  })
  const confirm = useMutation({
    mutationFn: (v: { email: string; code: string }) => confirmRecoveryEmail(client, v.email, v.code),
    onSuccess: async () => {
      toast.success('Email confirmed')
      await client.auth.refreshSession()
      await queryClient.invalidateQueries({ queryKey: queryKeys.authUser })
    },
    onError: (e: Error) => setProblem(e.message),
  })

  if (user.data?.verified) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="font-display text-xl">Recovery email</h2>
        <p className="mt-2 flex items-center gap-2 break-all">
          <MailCheck className="h-5 w-5 shrink-0 text-success-ink" aria-hidden />
          {user.data.email} is confirmed.
        </p>
      </section>
    )
  }

  const waitingForCode = sentAt !== null

  function onSend(e: FormEvent) {
    e.preventDefault()
    const result = validateForm(ForgotSchema, { email })
    setProblem(result.ok ? undefined : result.errors.email)
    if (result.ok) send.mutate(result.value.email)
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-display text-xl">Recovery email</h2>
      <p className="mt-1 text-sm text-muted">
        If you forget your password we send a 6-digit code to this email. Without it we cannot reset it for you.
      </p>
      {!waitingForCode ? (
        <form onSubmit={onSend} noValidate className="mt-3 flex flex-col gap-3">
          <Input
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setProblem(undefined)
            }}
            error={problem}
          />
          <Button type="submit" block disabled={send.isPending}>
            {send.isPending ? 'Sending…' : 'Send code'}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (isOtpComplete(code)) confirm.mutate({ email, code })
          }}
          className="mt-3 flex flex-col gap-3"
        >
          <p className="text-sm">
            We sent a code to <span className="break-all font-medium">{email}</span>. Look in Spam too.
          </p>
          <OtpInput value={code} onChange={(c) => { setCode(c); setProblem(undefined) }} error={problem} autoFocus />
          <Button type="submit" block disabled={!isOtpComplete(code) || confirm.isPending}>
            {confirm.isPending ? 'Checking…' : 'Confirm email'}
          </Button>
          <Button
            variant="secondary"
            block
            disabled={secondsLeft > 0 || send.isPending}
            onClick={() => send.mutate(email)}
          >
            {secondsLeft > 0 ? `Send again in ${secondsLeft}s` : 'Send the code again'}
          </Button>
          <button
            type="button"
            className="min-h-11 text-sm underline underline-offset-4"
            onClick={() => {
              setSentAt(null)
              setCode('')
              setProblem(undefined)
            }}
          >
            Use a different email
          </button>
        </form>
      )}
    </section>
  )
}
