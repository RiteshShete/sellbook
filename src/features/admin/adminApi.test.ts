import { describe, expect, it } from 'vitest'
import { AdminStatsSchema, FREE_DB_BYTES, FREE_STORAGE_BYTES, fillLevel } from './adminApi'

describe('fillLevel', () => {
  it('warns from 70% and says full at 100%', () => {
    expect(fillLevel(0, FREE_DB_BYTES)).toBe('ok')
    expect(fillLevel(0.69 * FREE_DB_BYTES, FREE_DB_BYTES)).toBe('ok')
    expect(fillLevel(0.7 * FREE_STORAGE_BYTES, FREE_STORAGE_BYTES)).toBe('warn')
    expect(fillLevel(FREE_STORAGE_BYTES, FREE_STORAGE_BYTES)).toBe('full')
    expect(fillLevel(2 * FREE_STORAGE_BYTES, FREE_STORAGE_BYTES)).toBe('full')
  })
})

describe('AdminStatsSchema', () => {
  it('parses what admin_stats() returns', () => {
    const stats = AdminStatsSchema.parse({
      shops: { total: 3, trial: 1, base: 1, pro: 0, ended: 1 },
      orders: 12,
      pending_requests: 1,
      db_bytes: 9_000_000,
      bill_bytes: 15_728_640,
      asset_bytes: 100_000,
    })
    expect(stats.shops.total).toBe(3)
  })

  it('rejects a response that is not the stats', () => {
    expect(() => AdminStatsSchema.parse({ shops: 3 })).toThrow()
  })
})
