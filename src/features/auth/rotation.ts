import { useEffect, useState } from 'react'

/** Picks a random index different from `current` (`rand` returns [0,1), injectable for tests). */
export function nextIndex(
  current: number,
  count: number,
  rand: () => number = Math.random,
): number {
  if (count <= 1) return 0
  const pick = Math.floor(rand() * (count - 1))
  return pick >= current ? pick + 1 : pick
}

/** Random delay in [minMs, maxMs). */
export function randomDelay(
  minMs: number,
  maxMs: number,
  rand: () => number = Math.random,
): number {
  return minMs + Math.floor(rand() * (maxMs - minMs))
}

/** Cycles through `count` items, switching after a random 3-6 s pause each time. */
export function useRandomRotation(count: number, minMs = 3000, maxMs = 6000): number {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * count))
  useEffect(() => {
    if (count <= 1) return
    const id = window.setTimeout(
      () => setIndex((i) => nextIndex(i, count)),
      randomDelay(minMs, maxMs),
    )
    return () => window.clearTimeout(id)
  }, [index, count, minMs, maxMs])
  return index
}
