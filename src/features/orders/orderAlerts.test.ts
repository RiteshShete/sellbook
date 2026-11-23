import { describe, expect, it } from 'vitest'
import { alertFor, titleWithCount } from './orderAlerts'

const row = (over: Record<string, unknown> = {}) => ({ order_no: 12, customer_name: 'Asha', source: 'customer', payment_claim_status: 'none', ...over })

describe('alertFor', () => {
  it('announces a new customer order', () => {
    expect(alertFor({ eventType: 'INSERT', new: row() })).toBe('New order #12 from Asha')
  })
  it('stays quiet for the owner\'s own new orders (they just typed them)', () => {
    expect(alertFor({ eventType: 'INSERT', new: row({ source: 'owner' }) })).toBeNull()
  })
  it('announces a payment claim once, when it first becomes "claimed"', () => {
    const claimed = row({ payment_claim_status: 'claimed' })
    expect(alertFor({ eventType: 'UPDATE', new: claimed, old: row() })).toMatch(/Payment claimed on order #12/)
    expect(alertFor({ eventType: 'UPDATE', new: claimed, old: claimed })).toBeNull()
  })
  it('stays quiet for other changes and for rows it cannot read', () => {
    expect(alertFor({ eventType: 'UPDATE', new: row(), old: row() })).toBeNull()
    expect(alertFor({ eventType: 'DELETE', new: {} })).toBeNull()
    expect(alertFor({ eventType: 'INSERT', new: 'nonsense' })).toBeNull()
  })
})

describe('titleWithCount', () => {
  it('shows the count while orders wait and removes it after', () => {
    expect(titleWithCount('Sellbook', 3)).toBe('(3) Sellbook')
    expect(titleWithCount('(3) Sellbook', 0)).toBe('Sellbook')
    expect(titleWithCount('(3) Sellbook', 5)).toBe('(5) Sellbook')
  })
})
