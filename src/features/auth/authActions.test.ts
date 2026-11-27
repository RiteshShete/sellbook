import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  addRecoveryEmail,
  changePassword,
  confirmRecoveryEmail,
  resetPasswordWithCode,
  sendRecoveryCode,
  signInWithId,
  signUpWithId,
} from './authActions'

type Result = { error: { message: string; code?: string } | null; data?: unknown }
const ok: Result = { error: null, data: {} }

/** A client whose auth calls are spies; each returns the result given (or ok). */
function fakeClient(over: Record<string, Result | (() => Result)> = {}) {
  const calls: string[] = []
  const reply = (name: string) => {
    calls.push(name)
    const r = over[name]
    return Promise.resolve(typeof r === 'function' ? r() : (r ?? ok))
  }
  const spy = (name: string) => vi.fn<(...a: unknown[]) => Promise<Result>>(() => reply(name))
  const auth = {
    signInWithPassword: spy('signInWithPassword'),
    signUp: spy('signUp'),
    resetPasswordForEmail: spy('resetPasswordForEmail'),
    verifyOtp: spy('verifyOtp'),
    updateUser: spy('updateUser'),
    getUser: spy('getUser'),
  }
  return { client: { auth } as unknown as SupabaseClient, auth, calls }
}

describe('signInWithId', () => {
  it('uses the email or the phone key, never both', async () => {
    const a = fakeClient()
    await signInWithId(a.client, { kind: 'email', email: 'a@b.co' }, 'pw')
    expect(a.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'pw' })
    const b = fakeClient()
    await signInWithId(b.client, { kind: 'phone', phone: '+919876543210' }, 'pw')
    expect(b.auth.signInWithPassword).toHaveBeenCalledWith({ phone: '+919876543210', password: 'pw' })
  })

  it('sends the captcha token only when there is one', async () => {
    const a = fakeClient()
    await signInWithId(a.client, { kind: 'email', email: 'a@b.co' }, 'pw', 'tok')
    expect(a.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'pw',
      options: { captchaToken: 'tok' },
    })
  })

  it('turns a wrong password into a readable error', async () => {
    const { client } = fakeClient({ signInWithPassword: { error: { message: 'Invalid login credentials' } } })
    await expect(signInWithId(client, { kind: 'email', email: 'a@b.co' }, 'x')).rejects.toThrow(
      'Wrong email, mobile number or password.',
    )
  })
})

describe('signUpWithId', () => {
  it('reports a session for a mobile sign-up and records the terms version', async () => {
    const { client, auth } = fakeClient({ signUp: { error: null, data: { session: { access_token: 't' } } } })
    const r = await signUpWithId(client, { kind: 'phone', phone: '+919876543210' }, 'secret-pw', 'captcha-token')
    expect(r).toEqual({ signedIn: true })
    const arg = auth.signUp.mock.calls[0]?.[0] as { phone: string; options: { captchaToken: string; data: object } }
    expect(arg.phone).toBe('+919876543210')
    expect(arg.options.captchaToken).toBe('captcha-token')
    expect(arg.options.data).toHaveProperty('terms_version')
  })

  it('reports no session for an email that still needs confirming, and sends no captcha key without a token', async () => {
    const { client, auth } = fakeClient({ signUp: { error: null, data: { session: null } } })
    const r = await signUpWithId(client, { kind: 'email', email: 'a@b.co' }, 'secret-pw')
    expect(r).toEqual({ signedIn: false })
    const arg = auth.signUp.mock.calls[0]?.[0] as { options: Record<string, unknown> }
    expect(arg.options).not.toHaveProperty('captchaToken')
  })

  it('offers sign-in when the number is already registered', async () => {
    const { client } = fakeClient({ signUp: { error: { message: 'User already registered', code: 'user_already_exists' } } })
    await expect(signUpWithId(client, { kind: 'phone', phone: '+919876543210' }, 'secret-pw')).rejects.toThrow(
      /Try signing in/,
    )
  })
})

describe('recovery by code', () => {
  it('sends the code to the email', async () => {
    const { client, auth } = fakeClient()
    await sendRecoveryCode(client, 'a@b.co', 'tok')
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.co', { captchaToken: 'tok' })
  })

  it('verifies the code first and sets the password only after it', async () => {
    const { client, calls } = fakeClient()
    await resetPasswordWithCode(client, 'a@b.co', '123456', 'new-secret')
    expect(calls).toEqual(['verifyOtp', 'updateUser'])
  })

  it('does not touch the password when the code is wrong', async () => {
    const { client, calls } = fakeClient({ verifyOtp: { error: { message: 'Token has expired or is invalid' } } })
    await expect(resetPasswordWithCode(client, 'a@b.co', '000000', 'new-secret')).rejects.toThrow(/wrong or has expired/)
    expect(calls).toEqual(['verifyOtp'])
  })
})

describe('recovery email', () => {
  it('attaches the email, then confirms it with the email_change code', async () => {
    const { client, auth } = fakeClient()
    await addRecoveryEmail(client, 'a@b.co')
    expect(auth.updateUser).toHaveBeenCalledWith({ email: 'a@b.co' })
    await confirmRecoveryEmail(client, 'a@b.co', '123456')
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '123456', type: 'email_change' })
  })

  it('says the email is taken when another account has it', async () => {
    const { client } = fakeClient({
      updateUser: { error: { message: 'A user with this email address has already been registered', code: 'email_exists' } },
    })
    await expect(addRecoveryEmail(client, 'a@b.co')).rejects.toThrow(/already has an account/)
  })
})

describe('changePassword', () => {
  it('re-checks the current password with the phone key for a mobile account, then updates', async () => {
    const { client, auth, calls } = fakeClient({ getUser: { error: null, data: { user: { phone: '919876543210' } } } })
    await changePassword(client, 'old-pw', 'new-secret')
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ phone: '+919876543210', password: 'old-pw' })
    expect(calls).toEqual(['getUser', 'signInWithPassword', 'updateUser'])
  })

  it('refuses a wrong current password without changing anything', async () => {
    const { client, calls } = fakeClient({
      getUser: { error: null, data: { user: { email: 'a@b.co' } } },
      signInWithPassword: { error: { message: 'Invalid login credentials' } },
    })
    await expect(changePassword(client, 'bad', 'new-secret')).rejects.toThrow('The current password is not right.')
    expect(calls).not.toContain('updateUser')
  })
})
