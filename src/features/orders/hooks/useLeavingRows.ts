import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../../../lib/motion'

/** How long a removed row stays on screen while it fades and collapses (ms). Matches `row-out` in index.css. */
export const LEAVE_MS = 450

/** Items that were in `prev` but are no longer in `next` (by id), in their old order. */
export function removedItems<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const ids = new Set(next.map((o) => o.id))
  return prev.filter((o) => !ids.has(o.id))
}

/**
 * Rows that just left the list (marked ready, delivered, ...). The list keeps showing them for a
 * moment so they can animate out instead of vanishing. Rows that come back (Undo) stop leaving at once.
 */
export function useLeavingRows<T extends { id: string }>(items: T[]): T[] {
  const [prev, setPrev] = useState(items)
  const [leaving, setLeaving] = useState<T[]>([])

  // Compare with the previous list while rendering (adjusting state, not an effect).
  if (prev !== items) {
    setPrev(items)
    const gone = prefersReducedMotion() ? [] : removedItems(prev, items)
    const back = new Set(items.map((o) => o.id))
    setLeaving((l) => [...l.filter((o) => !back.has(o.id)), ...gone])
  }

  const active = leaving.length > 0
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setLeaving([]), LEAVE_MS)
    return () => clearTimeout(timer)
  }, [active, leaving])

  return leaving
}
