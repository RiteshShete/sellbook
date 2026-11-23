import { z } from 'zod'

const Row = z.object({
  order_no: z.number().int(),
  customer_name: z.string(),
  source: z.string().nullish(),
  payment_claim_status: z.string().nullish(),
})

/**
 * The sentence for the in-app alert when a realtime change on `orders` arrives, or null when it needs none.
 * Only two things interrupt the owner: a new customer order, and a customer saying they paid.
 */
export function alertFor(payload: { eventType?: string; new?: unknown; old?: unknown }): string | null {
  const next = Row.safeParse(payload.new)
  if (!next.success) return null
  if (payload.eventType === 'INSERT' && next.data.source === 'customer') {
    return `New order #${next.data.order_no} from ${next.data.customer_name}`
  }
  if (payload.eventType === 'UPDATE' && next.data.payment_claim_status === 'claimed') {
    const before = Row.safeParse(payload.old)
    const wasClaimed = before.success && before.data.payment_claim_status === 'claimed'
    if (!wasClaimed) return `Payment claimed on order #${next.data.order_no}: check your bank`
  }
  return null
}

/** "(3) Sellbook" while 3 orders wait; the plain title otherwise. */
export function titleWithCount(base: string, count: number): string {
  const plain = base.replace(/^\(\d+\)\s*/, '')
  return count > 0 ? `(${count}) ${plain}` : plain
}
