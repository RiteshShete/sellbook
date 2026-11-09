import { useEffect, useState } from 'react'
import { prefersReducedMotion } from './motion'

/** Ease-out cubic: fast start, soft landing. `t` is 0..1. */
export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return 1 - (1 - c) ** 3
}

/** The value part-way from `from` to `to` (integers in, integer out, so money stays whole paise). */
export function interpolate(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * easeOutCubic(t))
}

interface Roll {
  target: number | undefined
  /** Where the roll starts (the value on screen when the target changed). */
  from: number | undefined
  shown: number | undefined
}

/**
 * Rolls a number to its new value instead of swapping it. The first value shows at once (no count-up
 * from 0 on page load); later changes ease over `duration` ms. With "reduce motion" it just jumps.
 */
export function useAnimatedNumber(target: number | undefined, duration = 500): number | undefined {
  const [roll, setRoll] = useState<Roll>({ target, from: undefined, shown: target })

  // Target changed: remember what is on screen now as the start (adjusting state during render).
  if (roll.target !== target) {
    const jump = target === undefined || roll.shown === undefined || prefersReducedMotion()
    setRoll({
      target,
      from: jump ? undefined : roll.shown,
      shown: jump ? target : roll.shown,
    })
  }

  const { from } = roll
  useEffect(() => {
    if (target === undefined || from === undefined || from === target) return
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = (now - start) / duration
      const next = t >= 1 ? target : interpolate(from, target, t)
      setRoll((r) => (r.target === target ? { ...r, shown: next } : r))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, from, duration])

  return roll.shown
}
