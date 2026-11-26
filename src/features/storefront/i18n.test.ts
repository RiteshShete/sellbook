import { describe, expect, it } from 'vitest'
import { t } from './i18n'

describe('t', () => {
  it('returns the English text', () => {
    expect(t('login.title')).toBe('Sign in')
  })

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(t('signup.intro', { shop: 'A Foods' })).toMatch(/^Order from A Foods and/)
    expect(t('signup.intro')).toMatch(/\{shop\}/)
  })
})
