/**
 * One order key per "this cart, this attempt". Tapping Place order twice, or a slow network and a retry, sends the SAME
 * key, so the server returns the same order. A changed cart is a different order and gets a new key. Kept in
 * sessionStorage (it survives a reload of the checkout page, not a new visit).
 */
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const keyName = (slug: string) => `sb:orderkey:${slug}`

export function orderKeyFor(storage: StorageLike | null, slug: string, signature: string, makeKey: () => string): string {
  try {
    const saved = storage?.getItem(keyName(slug))
    if (saved) {
      const parsed = JSON.parse(saved) as { sig?: unknown; key?: unknown }
      if (parsed.sig === signature && typeof parsed.key === 'string') return parsed.key
    }
  } catch {
    // unreadable: make a new key
  }
  const key = makeKey()
  try {
    storage?.setItem(keyName(slug), JSON.stringify({ sig: signature, key }))
  } catch {
    // storage blocked: the key lives only for this attempt, which is still enough to stop a double tap
  }
  return key
}

export function clearOrderKey(storage: StorageLike | null, slug: string): void {
  try {
    storage?.removeItem(keyName(slug))
  } catch {
    // nothing to clear
  }
}
