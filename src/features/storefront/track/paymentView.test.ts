import { describe, expect, it } from 'vitest'
import { paymentView } from './paymentView'

type O = Parameters<typeof paymentView>[0]
const upi = { method: 'upi', upi_id: 'shop@upi', payee_name: 'Shop' } as const
const base: O = { status: 'new', confirmation_status: 'pending', payment_status: 'pending', payment_claim_status: 'none', claim_count: 0, payment: upi }
const view = (over: Partial<O>) => paymentView({ ...base, ...over })

describe('paymentView', () => {
  it('an unpaid UPI order shows how to pay (before the shop has even confirmed it)', () => {
    expect(view({})).toBe('pay')
  })
  it('after "I have paid" the customer waits for the shop', () => {
    expect(view({ payment_claim_status: 'claimed', claim_count: 1 })).toBe('waiting')
  })
  it('a verified payment is confirmed', () => {
    expect(view({ payment_status: 'paid', payment_claim_status: 'verified', payment: { method: 'upi', upi_id: null, payee_name: null } })).toBe('paid')
  })
  it('a rejected claim can be tried again, up to three claims', () => {
    expect(view({ payment_claim_status: 'rejected', claim_count: 1 })).toBe('rejected')
    expect(view({ payment_claim_status: 'rejected', claim_count: 3 })).toBe('limit')
    expect(view({ claim_count: 3 })).toBe('limit')
  })
  it('pay on delivery shows the amount to hand over, and paid wins once the shop marks it', () => {
    const cod = { method: 'cod', upi_id: null, payee_name: null } as const
    expect(view({ payment: cod })).toBe('cod')
    expect(view({ payment: cod, payment_status: 'paid' })).toBe('paid')
  })
  it('a declined or cancelled order shows no payment area', () => {
    expect(view({ status: 'cancelled', confirmation_status: 'declined' })).toBe('none')
    expect(view({ status: 'cancelled' })).toBe('none')
  })
  it('shows nothing if the server sent no UPI details for an unpaid UPI order', () => {
    expect(view({ payment: { method: 'upi', upi_id: null, payee_name: null } })).toBe('none')
  })
})
