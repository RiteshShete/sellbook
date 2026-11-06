import { describe, expect, it } from 'vitest'
import { easeOutCubic, interpolate } from './useAnimatedNumber'

describe('useAnimatedNumber helpers', () => {
  it('easing starts at 0, ends at 1 and is clamped', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(-5)).toBe(0)
    expect(easeOutCubic(9)).toBe(1)
  })

  it('interpolates whole numbers (paise stay integers) in both directions', () => {
    expect(interpolate(0, 1000, 0)).toBe(0)
    expect(interpolate(0, 1000, 1)).toBe(1000)
    expect(Number.isInteger(interpolate(1, 10001, 0.37))).toBe(true)
    expect(interpolate(1000, 0, 1)).toBe(0)
    expect(interpolate(1000, 0, 0.5)).toBeLessThan(500)
  })
})
