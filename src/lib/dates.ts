import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

/** All business dates and month boundaries use India time, regardless of the device timezone. */
export const IST = 'Asia/Kolkata'

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Accepts a Date, an ISO timestamp, or a date-only "YYYY-MM-DD" (read as that day in IST). */
function toDate(value: Date | string): Date {
  const d =
    value instanceof Date
      ? value
      : DATE_ONLY_RE.test(value)
        ? fromZonedTime(`${value}T00:00:00`, IST)
        : new Date(value)
  if (Number.isNaN(d.getTime())) throw new RangeError('Invalid date')
  return d
}

/** "2026-10" for the month an instant falls in, in IST. */
export function isoMonth(value: Date | string): string {
  return formatInTimeZone(toDate(value), IST, 'yyyy-MM')
}

/** Today's calendar date in IST, "YYYY-MM-DD". `now` is injectable for tests. */
export function todayIST(now: Date = new Date()): string {
  return formatInTimeZone(now, IST, 'yyyy-MM-dd')
}

/** UTC instants for [start, end) of an IST month. end = start of the next IST month. */
export function monthRange(month: string): { start: Date; end: Date } {
  const m = MONTH_RE.exec(month)
  if (!m) throw new RangeError(`Invalid month "${month}", expected YYYY-MM`)
  const year = Number(m[1])
  const mon = Number(m[2])
  const nextYear = mon === 12 ? year + 1 : year
  const nextMon = mon === 12 ? 1 : mon + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: fromZonedTime(`${year}-${pad(mon)}-01T00:00:00`, IST),
    end: fromZonedTime(`${nextYear}-${pad(nextMon)}-01T00:00:00`, IST),
  }
}

export function previousMonth(month: string): string {
  return isoMonth(new Date(monthRange(month).start.getTime() - 1))
}

export function nextMonth(month: string): string {
  return isoMonth(monthRange(month).end)
}

/** "08 Oct 2026" */
export function formatDate(value: Date | string): string {
  return formatInTimeZone(toDate(value), IST, 'dd MMM yyyy')
}

/** "08 Oct 2026, 4:05 PM" */
export function formatDateTime(value: Date | string): string {
  return formatInTimeZone(toDate(value), IST, 'dd MMM yyyy, h:mm a')
}
