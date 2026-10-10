import { describe, expect, it } from 'vitest'
import { ACTION_STYLES, BADGE_STYLES, actionKindForMove, type ActionKind } from './actionStyles'

describe('ACTION_STYLES', () => {
  it('gives every action an icon and its own colour family', () => {
    for (const kind of Object.keys(ACTION_STYLES) as ActionKind[]) {
      expect(ACTION_STYLES[kind].Icon, kind).toBeTruthy()
    }
    expect(ACTION_STYLES.ready.className).toContain('bg-info')
    expect(ACTION_STYLES.delivered.className).toContain('bg-success')
    expect(ACTION_STYLES.paid.className).toContain('bg-teal')
    expect(ACTION_STYLES.back.className).toContain('border')
    expect(ACTION_STYLES.cancel.className).toContain('text-danger-ink')
  })

  it('uses no raw colours: tokens only', () => {
    const all = [
      ...Object.values(ACTION_STYLES).map((s) => s.className),
      ...Object.values(BADGE_STYLES),
    ]
    for (const c of all) expect(c).not.toMatch(/#[0-9a-f]{3,8}|\[#|rgb\(/i)
  })

  it('never shares a fill between Ready and Delivered, or Ready and Due today', () => {
    expect(ACTION_STYLES.ready.className).not.toBe(ACTION_STYLES.delivered.className)
    expect(BADGE_STYLES.ready).not.toBe(BADGE_STYLES.delivered)
    expect(BADGE_STYLES.ready).not.toBe(BADGE_STYLES.dueToday)
    expect(BADGE_STYLES.notPaid).not.toBe(BADGE_STYLES.overdue)
  })
})

describe('actionKindForMove', () => {
  it('maps pipeline moves to one style each, everywhere', () => {
    expect(actionKindForMove({ kind: 'forward', to: 'ready' })).toBe('ready')
    expect(actionKindForMove({ kind: 'forward', to: 'delivered' })).toBe('delivered')
    expect(actionKindForMove({ kind: 'back', to: 'new' })).toBe('back')
    expect(actionKindForMove({ kind: 'back', to: 'ready' })).toBe('back')
    expect(actionKindForMove({ kind: 'restore', to: 'ready' })).toBe('back')
    expect(actionKindForMove({ kind: 'cancel', to: 'cancelled' })).toBe('cancel')
  })
})
