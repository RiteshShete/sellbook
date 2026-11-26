import { describe, expect, it } from 'vitest'
import { googleLoginEnabled, returnUrl } from './GoogleButton'

describe('GoogleButton helpers', () => {
  it('is off unless the owner switches it on', () => expect(googleLoginEnabled).toBe(false))
  it('returns to a page inside this app, under its base path', () => {
    expect(returnUrl('a-foods/login')).toBe(`${window.location.origin}${import.meta.env.BASE_URL}a-foods/login`)
    expect(returnUrl('/create-shop')).toBe(`${window.location.origin}${import.meta.env.BASE_URL}create-shop`)
    expect(returnUrl('')).toBe(`${window.location.origin}${import.meta.env.BASE_URL}`)
  })
})
