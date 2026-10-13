import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDayMonth,
  formatDateTime,
  formatMonth,
  formatMonthShort,
  isMonthKey,
  isoMonth,
  monthRange,
  nextMonth,
  previousMonth,
  todayIST,
  addDaysIST,
} from './dates'

const iso = (d: Date) => d.toISOString()

describe('monthRange (IST, UTC+05:30)', () => {
  it('returns UTC instants for start and end', () => {
    const r = monthRange('2026-10')
    expect(iso(r.start)).toBe('2026-09-30T18:30:00.000Z')
    expect(iso(r.end)).toBe('2026-10-31T18:30:00.000Z')
  })
  it('handles month end for 30/31-day and leap-Feb months', () => {
    expect(iso(monthRange('2026-04').end)).toBe('2026-04-30T18:30:00.000Z')
    expect(iso(monthRange('2026-02').end)).toBe('2026-02-28T18:30:00.000Z')
    expect(iso(monthRange('2028-02').end)).toBe('2028-02-29T18:30:00.000Z')
  })
  it('rolls over the year', () => {
    const r = monthRange('2026-12')
    expect(iso(r.start)).toBe('2026-11-30T18:30:00.000Z')
    expect(iso(r.end)).toBe('2026-12-31T18:30:00.000Z')
  })
  it('end of one month equals start of the next', () => {
    expect(monthRange('2026-09').end.getTime()).toBe(monthRange('2026-10').start.getTime())
  })
  it('rejects invalid months', () => {
    for (const bad of ['2026-13', '2026-00', '26-10', '2026-1', '', '2026-10-01']) {
      expect(() => monthRange(bad), bad).toThrow(RangeError)
    }
  })
})

describe('isoMonth around midnight IST', () => {
  it('23:59:59.999 IST on the last day is still the old month', () => {
    expect(isoMonth(new Date('2026-09-30T18:29:59.999Z'))).toBe('2026-09')
  })
  it('00:00:00 IST on the 1st is the new month', () => {
    expect(isoMonth(new Date('2026-09-30T18:30:00.000Z'))).toBe('2026-10')
  })
  it('crosses the year boundary in IST, not UTC', () => {
    expect(isoMonth(new Date('2026-12-31T18:29:59Z'))).toBe('2026-12')
    expect(isoMonth(new Date('2026-12-31T18:30:00Z'))).toBe('2027-01')
  })
  it('a late-evening UTC instant already belongs to the next IST month', () => {
    expect(isoMonth('2026-03-31T20:00:00Z')).toBe('2026-04')
  })
  it('treats date-only strings as that day in IST', () => {
    expect(isoMonth('2026-10-01')).toBe('2026-10')
    expect(isoMonth('2026-09-30')).toBe('2026-09')
  })
  it('is consistent with monthRange boundaries', () => {
    const { start, end } = monthRange('2026-10')
    expect(isoMonth(start)).toBe('2026-10')
    expect(isoMonth(new Date(end.getTime() - 1))).toBe('2026-10')
    expect(isoMonth(end)).toBe('2026-11')
  })
})

describe('previousMonth / nextMonth', () => {
  it('moves across year boundaries', () => {
    expect(previousMonth('2026-01')).toBe('2025-12')
    expect(nextMonth('2026-12')).toBe('2027-01')
    expect(previousMonth('2026-10')).toBe('2026-09')
    expect(nextMonth('2026-02')).toBe('2026-03')
  })
})

describe('todayIST', () => {
  it('uses the IST calendar date', () => {
    expect(todayIST(new Date('2026-10-08T18:29:00Z'))).toBe('2026-10-08')
    expect(todayIST(new Date('2026-10-08T18:31:00Z'))).toBe('2026-10-09')
  })
})

describe('formatDate / formatDateTime', () => {
  it('formats in IST', () => {
    expect(formatDate(new Date('2026-09-30T18:30:00Z'))).toBe('01 Oct 2026')
    expect(formatDate('2026-10-08')).toBe('08 Oct 2026')
    expect(formatDateTime(new Date('2026-10-08T10:35:00Z'))).toBe('08 Oct 2026, 4:05 PM')
  })
  it('throws on invalid input', () => {
    expect(() => formatDate('nope')).toThrow(RangeError)
  })
})

describe('month keys and labels', () => {
  it('validates YYYY-MM', () => {
    expect(isMonthKey('2026-10')).toBe(true)
    expect(isMonthKey('2026-13')).toBe(false)
    expect(isMonthKey('2026-1')).toBe(false)
    expect(isMonthKey('')).toBe(false)
  })
  it('labels the IST month, not the device month', () => {
    expect(formatMonth('2026-10')).toBe('October 2026')
    expect(formatMonth('2027-01')).toBe('January 2027')
    expect(formatMonthShort('2026-09')).toBe('Sep')
  })
})

describe('formatDayMonth', () => {
  it('formats the IST day', () => {
    expect(formatDayMonth('2026-10-12')).toBe('12 Oct')
    expect(formatDayMonth(new Date('2026-09-30T18:30:00Z'))).toBe('01 Oct')
  })
})

describe('addDaysIST', () => {
  it('adds days across month and year ends', () => {
    expect(addDaysIST('2026-10-31', 2)).toBe('2026-11-02')
    expect(addDaysIST('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysIST('2026-03-01', -1)).toBe('2026-02-28')
  })
})
