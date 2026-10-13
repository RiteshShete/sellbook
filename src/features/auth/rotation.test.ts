import { describe, expect, it } from 'vitest'
import { nextIndex, randomDelay } from './rotation'

describe('nextIndex', () => {
  it('never repeats the current index', () => {
    for (const current of [0, 1, 2]) {
      for (const r of [0, 0.3, 0.5, 0.99]) {
        expect(nextIndex(current, 3, () => r)).not.toBe(current)
      }
    }
  })
  it('stays in range', () => {
    for (const r of [0, 0.5, 0.999]) {
      const n = nextIndex(1, 2, () => r)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(2)
    }
  })
  it('returns 0 for a single item', () => {
    expect(nextIndex(0, 1)).toBe(0)
  })
})

describe('randomDelay', () => {
  it('is within [min, max)', () => {
    expect(randomDelay(3000, 6000, () => 0)).toBe(3000)
    expect(randomDelay(3000, 6000, () => 0.999)).toBeLessThan(6000)
  })
})
