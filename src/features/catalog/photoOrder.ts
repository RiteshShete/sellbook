/** A copy of the list with the item at `index` moved one place earlier (-1) or later (+1); unchanged at the ends. */
export function movePhoto<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta
  const next = [...list]
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return next
  const [item] = next.splice(index, 1) as [T]
  next.splice(to, 0, item)
  return next
}
