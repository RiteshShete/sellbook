import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

const good = {
  VITE_SUPABASE_URL: 'https://abc.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'x'.repeat(40),
}

describe('parseEnv', () => {
  it('accepts valid values', () => {
    expect(parseEnv(good).ok).toBe(true)
  })
  it('reports missing values readably', () => {
    const r = parseEnv({})
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.problems).toContain('VITE_SUPABASE_URL: is missing')
      expect(r.problems).toContain('VITE_SUPABASE_ANON_KEY: is missing')
    }
  })
  it('rejects a malformed URL', () => {
    expect(parseEnv({ ...good, VITE_SUPABASE_URL: 'not a url' }).ok).toBe(false)
  })
})
