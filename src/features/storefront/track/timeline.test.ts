import { describe, expect, it } from 'vitest'
import { isOrderFinal, orderEnding, orderSteps } from './timeline'

type S = Parameters<typeof orderSteps>[0]
const state = (o: S) => orderSteps(o).map((s) => s.state)

describe('orderSteps', () => {
  it('a new customer order waits for the shop to confirm', () => {
    expect(state({ status: 'new', confirmation_status: 'pending' })).toEqual(['done', 'current', 'todo', 'todo'])
  })
  it('confirmed, then ready, then delivered', () => {
    expect(state({ status: 'new', confirmation_status: 'confirmed' })).toEqual(['done', 'done', 'current', 'todo'])
    expect(state({ status: 'ready', confirmation_status: 'confirmed' })).toEqual(['done', 'done', 'done', 'current'])
    expect(state({ status: 'delivered', confirmation_status: 'confirmed' })).toEqual(['done', 'done', 'done', 'done'])
  })
})

describe('orderEnding', () => {
  it('tells a decline from a cancellation', () => {
    expect(orderEnding({ status: 'cancelled', confirmation_status: 'declined' })).toBe('declined')
    expect(orderEnding({ status: 'cancelled', confirmation_status: 'pending' })).toBe('cancelled')
    expect(orderEnding({ status: 'new', confirmation_status: 'pending' })).toBeNull()
  })
})

describe('isOrderFinal (when to stop checking every 20 seconds)', () => {
  const base = { status: 'new', confirmation_status: 'pending', payment_status: 'pending', payment: { method: 'upi', upi_id: null, payee_name: null } } as const
  it('keeps going while the order is open', () => expect(isOrderFinal(base)).toBe(false))
  it('stops once it ended', () => {
    expect(isOrderFinal({ ...base, status: 'cancelled', confirmation_status: 'declined' })).toBe(true)
  })
  it('a delivered UPI order is final only once paid; COD as soon as it is delivered', () => {
    expect(isOrderFinal({ ...base, status: 'delivered', confirmation_status: 'confirmed' })).toBe(false)
    expect(isOrderFinal({ ...base, status: 'delivered', confirmation_status: 'confirmed', payment_status: 'paid' })).toBe(true)
    expect(isOrderFinal({ ...base, status: 'delivered', confirmation_status: 'confirmed', payment: { ...base.payment, method: 'cod' } })).toBe(true)
  })
})
