import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { errorMessage, readableDbError, throwIfError } from './dbError'

describe('readableDbError', () => {
  it('maps known Postgres / PostgREST codes', () => {
    expect(readableDbError({ code: '23505', message: 'duplicate key' })).toMatch(/already used/)
    expect(readableDbError({ code: '42501', message: 'permission denied' })).toMatch(/Not allowed/)
    expect(readableDbError({ code: 'PGRST202', message: 'x' })).toMatch(/migration/)
    expect(readableDbError({ code: 'SB409', message: 'x' })).toMatch(/another device/)
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

describe('errorMessage', () => {
  it('hides a ZodError issue list behind a sentence', () => {
    const parsed = z.object({ a: z.number() }).safeParse({ a: 'x' })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(errorMessage(parsed.error)).toMatch(/Unexpected data/)
  })
  it('keeps readable Error messages and covers non-errors', () => {
    expect(errorMessage(new Error('Product not found'))).toBe('Product not found')
    expect(errorMessage('boom')).toBe('Something went wrong. Try again.')
  })
})
