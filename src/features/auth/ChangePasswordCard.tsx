import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button, Input, toast } from '../../components/ui'
import { changePassword } from './authActions'
import { NewPasswordSchema, validateForm } from './schemas'
import { useAuth } from './useAuth'

/** Change the password: the current one is asked first (signing in again proves it), then the new one is set. */
export function ChangePasswordCard() {
  const { client } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const change = useMutation({
    mutationFn: () => changePassword(client, current, next),
    onSuccess: () => {
      toast.success('Password changed')
      setCurrent('')
      setNext('')
    },
    onError: (e: Error) => setErrors({ current: e.message }),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateForm(NewPasswordSchema, { password: next })
    const found: Record<string, string> = result.ok ? {} : { next: result.errors.password ?? '' }
    if (!current) found.current = 'Enter your current password'
    setErrors(found)
    if (Object.keys(found).length === 0) change.mutate()
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-display text-xl">Change password</h2>
      <form onSubmit={onSubmit} noValidate className="mt-3 flex flex-col gap-3">
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value)
            setErrors({})
          }}
          error={errors.current}
        />
        <Input
          label="New password (at least 8 characters)"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => {
            setNext(e.target.value)
            setErrors({})
          }}
          error={errors.next}
        />
        <Button type="submit" block disabled={change.isPending}>
          {change.isPending ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </section>
  )
}
