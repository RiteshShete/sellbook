import { Chip } from '../../../components/ui'
import { addDaysIST, todayIST } from '../../../lib/dates'

const QUICK = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 2 days', days: 2 },
]

/** One-tap due dates, counted from today in India time. A date before the order date is not offered. */
export function DueChips({
  value,
  orderDate,
  onPick,
  today = todayIST(),
}: {
  value: string
  orderDate: string
  onPick: (date: string) => void
  today?: string
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick due date">
      {QUICK.map((q) => {
        const date = addDaysIST(today, q.days)
        if (date < orderDate) return null
        return (
          <Chip key={q.label} selected={value === date} onClick={() => onPick(date)}>
            {q.label}
          </Chip>
        )
      })}
    </div>
  )
}
