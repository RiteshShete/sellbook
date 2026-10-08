import { describe, expect, it } from 'vitest'
import { readableDbError, throwIfError } from './dbError'

describe('readableDbError', () => {
  it('maps known Postgres / PostgREST codes', () => {
    expect(readableDbError({ code: '23505', message: 'duplicate key' })).toMatch(/already used/)
    expect(readableDbError({ code: '42501', message: 'permission denied' })).toMatch(/Not allowed/)
    expect(readableDbError({ code: 'PGRST202', message: 'x' })).toMatch(/migration/)
  })

  it('maps network failures', () => {
    expect(readableDbError({ message: 'TypeError: Failed to fetch' })).toMatch(/internet/)
  })

  it('capitalises our own RPC messages', () => {
    expect(readableDbError({ code: 'P0001', message: 'restore the product first' })).toBe(
      'Restore the product first',
    )
  })
})

describe('throwIfError', () => {
  it('does nothing for null and throws a readable Error otherwise', () => {
    expect(() => throwIfError(null)).not.toThrow()
    expect(() => throwIfError({ code: '23505', message: 'dup' })).toThrow(/already used/)
  })
})
