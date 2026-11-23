import { describe, expect, it } from 'vitest'
import {
  ForgotSchema,
  NewPasswordSchema,
  readableAuthError,
  SignupSchema,
  validateForm,
  validateLogin,
} from './schemas'

describe('validateLogin', () => {
  it('accepts a valid email and password, trimming the email', () => {
    const r = validateLogin({ email: '  owner@shop.in ', password: 'secret' })
    expect(r).toEqual({ ok: true, value: { email: 'owner@shop.in', password: 'secret' } })
  })

  it('reports an empty form per field', () => {
    const r = validateLogin({ email: '', password: '' })
    expect(r).toEqual({
      ok: false,
      errors: { email: 'Enter your email', password: 'Enter your password' },
    })
  })

  it('rejects a malformed email', () => {
    const r = validateLogin({ email: 'not-an-email', password: 'x' })
    expect(r).toEqual({ ok: false, errors: { email: 'Enter a valid email' } })
  })
})

describe('readableAuthError', () => {
  it('maps bad credentials', () => {
    expect(readableAuthError('Invalid login credentials')).toBe('Wrong email, mobile number or password.')
  })
  it('maps network failures', () => {
    expect(readableAuthError('Failed to fetch')).toMatch(/internet/)
  })
  it('passes unknown messages through', () => {
    expect(readableAuthError('Something odd')).toBe('Something odd')
  })
})

describe('validateForm (sign-up, forgot, new password)', () => {
  it('accepts a sign-up with a trimmed email, an 8+ character password and the terms ticked', () => {
    const r = validateForm(SignupSchema, { email: ' new@shop.in ', password: 'longenough', accept: true })
    expect(r).toEqual({ ok: true, value: { email: 'new@shop.in', password: 'longenough', accept: true } })
  })

  it('gives one message per field: bad email, short password, terms not ticked', () => {
    const r = validateForm(SignupSchema, { email: 'nope', password: 'short', accept: false })
    expect(r).toEqual({
      ok: false,
      errors: {
        email: 'Enter a valid email',
        password: 'Use at least 8 characters',
        accept: 'Please accept the terms to continue',
      },
    })
  })

  it('checks the forgot and new-password forms the same way', () => {
    expect(validateForm(ForgotSchema, { email: '' })).toEqual({ ok: false, errors: { email: 'Enter your email' } })
    expect(validateForm(NewPasswordSchema, { password: 'x'.repeat(73) })).toEqual({
      ok: false,
      errors: { password: 'Use at most 72 characters' },
    })
    expect(validateForm(NewPasswordSchema, { password: '12345678' }).ok).toBe(true)
  })
})

describe('readableAuthError for accounts', () => {
  it('explains closed sign-ups and a reused password', () => {
    expect(readableAuthError('Signups not allowed for this instance')).toBe('New accounts are not open yet.')
    expect(readableAuthError('New password should be different from the old password.')).toBe(
      'Choose a password you have not used here before.',
    )
  })
})

describe('readableAuthError for storefront accounts', () => {
  it('offers sign-in when the number or email is already registered', () => {
    expect(readableAuthError('User already registered')).toMatch(/Try signing in/)
    expect(readableAuthError('x', 'phone_exists')).toMatch(/Try signing in/)
    expect(readableAuthError('x', 'email_exists')).toMatch(/Try signing in/)
  })
  it('explains a short password, a bad or expired code, a failed check', () => {
    expect(readableAuthError('Password should be at least 8 characters')).toBe('Use at least 8 characters.')
    expect(readableAuthError('Token has expired or is invalid')).toMatch(/wrong or has expired/)
    expect(readableAuthError('x', 'otp_expired')).toMatch(/wrong or has expired/)
    expect(readableAuthError('captcha verification process failed')).toMatch(/complete the check/)
  })
  it('says mobile sign-up is not open when the phone provider is off', () => {
    expect(readableAuthError('Phone signups are disabled', 'phone_provider_disabled')).toMatch(/Use an email/)
  })
  it('keeps a rate-limit message for emails too', () => {
    expect(readableAuthError('x', 'over_email_send_rate_limit')).toMatch(/Too many emails/)
  })
})
