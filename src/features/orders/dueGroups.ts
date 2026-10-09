import { todayIST } from '../../lib/dates'

export type DueGroupKey = 'overdue' | 'today' | 'tomorrow' | 'later' | 'none'

export const DUE_GROUP_LABEL: Record<DueGroupKey, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  tomorrow: 'Due tomorrow',
  later: 'Later',
  none: 'No due date',
}

const ORDER: DueGroupKey[] = ['overdue', 'today', 'tomorrow', 'later', 'none']

/** "YYYY-MM-DD" + 1 day, as a plain calendar date (no timezone involved). */
export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function dueGroup(due: string | null, today: string): DueGroupKey {
  if (!due) return 'none'
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  if (due === nextDay(today)) return 'tomorrow'
  return 'later'
}

/** Groups orders by due date (IST calendar days), earliest first inside each group. */
export function groupByDue<T extends { due_date: string | null; order_no: number }>(
  orders: T[],
  today: string = todayIST(),
): { key: DueGroupKey; label: string; orders: T[] }[] {
  const sorted = [...orders].sort(
    (a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.order_no - b.order_no,
  )
  return ORDER.map((key) => ({
    key,
    label: DUE_GROUP_LABEL[key],
    orders: sorted.filter((o) => dueGroup(o.due_date, today) === key),
  })).filter((g) => g.orders.length > 0)
}
