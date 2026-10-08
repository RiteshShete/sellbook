import { describe, expect, it } from 'vitest'
import { dueGroup, groupByDue, nextDay } from './groupByDue'

describe('nextDay', () => {
  it('crosses month and year ends', () => {
    expect(nextDay('2026-10-31')).toBe('2026-11-01')
    expect(nextDay('2026-12-31')).toBe('2027-01-01')
    expect(nextDay('2028-02-28')).toBe('2028-02-29')
  })
})

describe('groupByDue', () => {
  const today = '2026-10-09'

  it('classifies due dates relative to today', () => {
    expect(
      [null, '2026-10-01', today, '2026-10-10', '2026-10-20'].map((d) => dueGroup(d, today)),
    ).toEqual(['none', 'overdue', 'today', 'tomorrow', 'later'])
  })

  it('returns non-empty groups in order, earliest due first', () => {
    const groups = groupByDue(
      [
        { order_no: 4, due_date: null },
        { order_no: 3, due_date: '2026-10-20' },
        { order_no: 2, due_date: '2026-10-05' },
        { order_no: 1, due_date: '2026-10-02' },
        { order_no: 5, due_date: today },
      ],
      today,
    )
    expect(groups.map((g) => [g.key, g.orders.map((o) => o.order_no)])).toEqual([
      ['overdue', [1, 2]],
      ['today', [5]],
      ['later', [3]],
      ['none', [4]],
    ])
  })
})
