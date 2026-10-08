import { describe, expect, it } from 'vitest'
import { moveMessage, needsItems, paymentLabel, paymentState, statusMoves } from './pipeline'

const targets = (status: Parameters<typeof statusMoves>[0]['status'], from = null) =>
  statusMoves({ status, cancelled_from: from }).map((m) => m.to)

describe('statusMoves (mirrors set_order_status)', () => {
  it('allows one step forward or back, and cancel', () => {
    expect(targets('new')).toEqual(['ready', 'cancelled'])
    expect(targets('ready')).toEqual(['delivered', 'new', 'cancelled'])
    expect(targets('delivered')).toEqual(['ready', 'cancelled'])
  })

  it('restores a cancelled order only to where it was', () => {
    expect(statusMoves({ status: 'cancelled', cancelled_from: 'delivered' })).toEqual([
      { to: 'delivered', label: 'Restore (Delivered)', kind: 'restore' },
    ])
  })

  it('the undo of every move (move back to from) is itself an allowed move', () => {
    const all = ['new', 'ready', 'delivered'] as const
    for (const from of all) {
      for (const m of statusMoves({ status: from, cancelled_from: null })) {
        const back = statusMoves({
          status: m.to,
          cancelled_from: m.to === 'cancelled' ? from : null,
        }).map((x) => x.to)
        expect(back).toContain(from)
      }
    }
  })
})

describe('helpers', () => {
  it('B9 applies to ready and delivered only', () => {
    expect((['new', 'ready', 'delivered', 'cancelled'] as const).map(needsItems)).toEqual([
      false,
      true,
      true,
      false,
    ])
  })

  it('writes readable toast messages', () => {
    expect(moveMessage(7, 'ready', 'delivered')).toBe('#7 → Delivered')
    expect(moveMessage(7, 'new', 'cancelled')).toBe('#7 cancelled')
    expect(moveMessage(7, 'cancelled', 'ready')).toBe('#7 restored to Ready')
  })

  it('narrows payment state and labels it', () => {
    expect(paymentLabel(paymentState({ payment_status: 'paid', payment_mode: 'cash' }))).toBe(
      'Paid · Cash',
    )
    expect(paymentState({ payment_status: 'paid', payment_mode: null })).toEqual({
      payment_status: 'pending',
      payment_mode: null,
    })
  })
})
