import type { CustomerOrder } from '../types'

export type StepState = 'done' | 'current' | 'todo'
export interface Step {
  key: 'placed' | 'confirmed' | 'ready' | 'delivered'
  state: StepState
}

type OrderState = Pick<CustomerOrder, 'status' | 'confirmation_status'>

/** How the order ended, if it did: the shop said no, or it was cancelled. */
export function orderEnding(o: OrderState): 'declined' | 'cancelled' | null {
  if (o.confirmation_status === 'declined') return 'declined'
  return o.status === 'cancelled' ? 'cancelled' : null
}

/** Placed -> Confirmed -> Ready -> Delivered, with where the order is now. */
export function orderSteps(o: OrderState): Step[] {
  const confirmed = o.confirmation_status === 'confirmed' || o.confirmation_status === 'not_needed' || o.status === 'ready' || o.status === 'delivered'
  // How many steps are finished: Placed always is; delivered means all four.
  const rank = o.status === 'delivered' ? 4 : o.status === 'ready' ? 3 : confirmed ? 2 : 1
  const keys: Step['key'][] = ['placed', 'confirmed', 'ready', 'delivered']
  return keys.map((key, i) => ({ key, state: i < rank ? 'done' : i === rank ? 'current' : 'todo' }))
}

/** True when nothing more will change, so the page can stop looking every 20 seconds. */
export function isOrderFinal(o: Pick<CustomerOrder, 'status' | 'confirmation_status' | 'payment_status' | 'payment'>): boolean {
  if (orderEnding(o) !== null) return true
  return o.status === 'delivered' && (o.payment_status === 'paid' || o.payment.method === 'cod')
}
