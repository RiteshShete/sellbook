import { describe, expect, it } from 'vitest'
import { uuid } from './id'

describe('uuid', () => {
  it('returns distinct RFC 4122 v4 ids', () => {
    const a = uuid()
    const b = uuid()
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(a).not.toBe(b)
  })
})
