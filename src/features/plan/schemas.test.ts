import { describe, expect, it } from 'vitest'
import { daysLeft, planChip, planNotice, planPayLink, PlanSchema, type Plan, type PlanLimit } from './schemas'

const NOW = new Date('2026-11-20T06:00:00Z')
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString()

function plan(over: Partial<Plan> = {}): Plan {
  return {
    tier: 'base',
    status: 'active',
    ends_at: inDays(20),
    readonly_until: inDays(80),
    can_write: true,
    pro_features: false,
    limits: { orders: 100, orders_scope: 'month', products: 30 },
    usage: { orders: 10, products: 3 },
    storage: { used: 0, limit: 104857600, keep_days: 90 },
    pay_ref: 'SB-1A2B3C4D',
    pay_to: { upi_id: 'platform@okbank', payee_name: 'Sellbook', support_email: null },
    request: null,
    ...over,
  }
}

describe('PlanSchema', () => {
  it('parses my_plan() for a shop without a subscription row (all nulls, locked)', () => {
    const p = PlanSchema.parse({
      tier: null,
      status: 'locked',
      ends_at: null,
      readonly_until: null,
      can_write: false,
      pro_features: false,
      limits: { orders: null, orders_scope: null, products: null },
      usage: { orders: 0, products: 0 },
    })
    expect(p.status).toBe('locked')
  })

  it('rejects an unknown status', () => {
    expect(() => PlanSchema.parse({ ...plan(), status: 'paused' })).toThrow()
  })
})

describe('planNotice', () => {
  it('says nothing when all is well', () => {
    expect(planNotice(plan(), NOW)).toBeNull()
  })

  it('puts an ended plan first, read-only then locked', () => {
    expect(planNotice(plan({ status: 'grace_readonly', usage: { orders: 100, products: 30 } }), NOW)).toEqual({
      tone: 'danger',
      text: 'Your plan has ended. The shop is read-only until you renew.',
    })
    expect(planNotice(plan({ status: 'locked' }), NOW)?.text).toBe('Your plan has ended. Renew to use the shop.')
  })

  it('warns in the last 7 days, with trial wording', () => {
    expect(planNotice(plan({ ends_at: inDays(8) }), NOW)).toBeNull()
    expect(planNotice(plan({ ends_at: inDays(7) }), NOW)?.text).toBe('Your plan ends in 7 days.')
    expect(planNotice(plan({ ends_at: inDays(1), status: 'trial' }), NOW)?.text).toBe('Your free trial ends in 1 day.')
    expect(planNotice(plan({ ends_at: inDays(0.2) }), NOW)?.text).toBe('Your plan ends in 1 day.')
    expect(planNotice(plan({ ends_at: inDays(0) }), NOW)?.text).toBe('Your plan ends today.')
  })

  it('warns from 80% of the order or product limit, never for "no limit"', () => {
    expect(planNotice(plan({ usage: { orders: 79, products: 3 } }), NOW)).toBeNull()
    expect(planNotice(plan({ usage: { orders: 80, products: 3 } }), NOW)?.text).toBe('80 of 100 orders used this month.')
    const trial = plan({ status: 'trial', limits: { orders: 10, orders_scope: 'total', products: 5 }, usage: { orders: 8, products: 0 } })
    expect(planNotice(trial, NOW)?.text).toBe('8 of 10 orders used in the trial.')
    expect(planNotice(plan({ usage: { orders: 0, products: 24 } }), NOW)?.text).toBe('24 of 30 products used.')
    const pro = plan({ limits: { orders: 500, orders_scope: 'month', products: null }, usage: { orders: 0, products: 900 } })
    expect(planNotice(pro, NOW)).toBeNull()
  })
})

describe('planChip', () => {
  it('names the plan and the order use, per month or in total', () => {
    expect(planChip(plan())).toBe('Base · 10 of 100 orders this month')
    expect(planChip(plan({ tier: 'trial', limits: { orders: 10, orders_scope: 'total', products: 5 } }))).toBe(
      'Free trial · 10 of 10 orders',
    )
  })

  it('counts orders without a limit and copes with no plan', () => {
    expect(planChip(plan({ tier: 'pro', limits: { orders: null, orders_scope: null, products: null } }))).toBe('Pro · 10 orders')
    expect(planChip(plan({ tier: null }))).toBe('No plan · 10 of 100 orders this month')
  })
})

describe('storage notice', () => {
  it('warns from 80% of the bill storage, and says when it is full', () => {
    expect(planNotice(plan({ storage: { used: 70 * 1048576, limit: 104857600, keep_days: 90 } }), NOW)).toBeNull()
    expect(planNotice(plan({ storage: { used: 85 * 1048576, limit: 104857600, keep_days: 90 } }), NOW)?.text).toBe(
      'Bill storage is almost full: 85 MB of 100 MB.',
    )
    expect(planNotice(plan({ storage: { used: 104857600, limit: 104857600, keep_days: 90 } }), NOW)?.text).toBe(
      'Bill storage is full: 100 MB of 100 MB.',
    )
  })

  it('says nothing when there is no cap', () => {
    expect(planNotice(plan({ storage: { used: 5e9, limit: null, keep_days: null } }), NOW)).toBeNull()
  })
})

describe('planPayLink', () => {
  const pro: PlanLimit = {
    tier: 'pro',
    price_paise: 25000,
    orders_limit: 500,
    orders_scope: 'month',
    products_limit: null,
    pro_features: true,
    period_days: 30,
    storage_bytes: 314572800,
    bill_keep_days: 365,
  }

  it('builds the UPI link with the exact amount and the shop reference', () => {
    expect(planPayLink(plan(), pro)).toBe(
      'upi://pay?pa=platform%40okbank&pn=Sellbook&am=250.00&cu=INR&tn=Sub%20SB-1A2B3C4D',
    )
  })

  it('is null until the platform has a valid UPI ID and payee name', () => {
    expect(planPayLink(plan({ pay_to: null }), pro)).toBeNull()
    const noName = { upi_id: 'platform@okbank', payee_name: '', support_email: null }
    expect(planPayLink(plan({ pay_to: noName }), pro)).toBeNull()
    const badId = { upi_id: 'not-a-upi-id', payee_name: 'Sellbook', support_email: null }
    expect(planPayLink(plan({ pay_to: badId }), pro)).toBeNull()
  })
})

describe('daysLeft', () => {
  it('is null without an end date and negative after it', () => {
    expect(daysLeft(null, NOW)).toBeNull()
    expect(daysLeft(inDays(-2), NOW)).toBe(-2)
  })
})
