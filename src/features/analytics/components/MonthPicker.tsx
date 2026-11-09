import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonthShort, nextMonth, previousMonth } from '../../../lib/dates'

interface Props {
  month: string
  /** The current IST month: you cannot step past it. */
  latest: string
  onChange: (month: string) => void
  className?: string
}

const STEP =
  'flex min-h-11 min-w-11 items-center justify-center rounded-xl active:bg-surface-2 disabled:opacity-40'

/** "‹ Nov 2026 ›" pill, shown in the Analytics header (and under it on very narrow phones). */
export function MonthPicker({ month, latest, onChange, className = '' }: Props) {
  const atLatest = month >= latest // "YYYY-MM" strings sort like dates
  return (
    <div
      className={`items-center rounded-xl border border-border bg-surface ${className}`}
      role="group"
      aria-label="Month"
    >
      <button
        type="button"
        aria-label="Previous month"
        className={STEP}
        onClick={() => onChange(previousMonth(month))}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <p className="px-1 text-base font-semibold whitespace-nowrap" aria-live="polite">
        {formatMonthShort(month)} {month.slice(0, 4)}
      </p>
      <button
        type="button"
        aria-label="Next month"
        disabled={atLatest}
        className={STEP}
        onClick={() => onChange(nextMonth(month))}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}
