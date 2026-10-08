import { describe, expect, it } from 'vitest'
import { readableAuthError, validateLogin } from './schemas'

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
    expect(readableAuthError('Invalid login credentials')).toBe('Wrong email or password.')
  })
  it('maps network failures', () => {
    expect(readableAuthError('Failed to fetch')).toMatch(/internet/)
  })
  it('passes unknown messages through', () => {
    expect(readableAuthError('Something odd')).toBe('Something odd')
  })
})
