import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../../../components/ui'
import { formatMonth, nextMonth, previousMonth } from '../../../lib/dates'

interface Props {
  month: string
  /** The current IST month: you cannot step past it. */
  latest: string
  onChange: (month: string) => void
}

export function MonthPicker({ month, latest, onChange }: Props) {
  const atLatest = month >= latest // "YYYY-MM" strings sort like dates
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-1">
      <Button
        variant="ghost"
        aria-label="Previous month"
        onClick={() => onChange(previousMonth(month))}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <p className="font-semibold" aria-live="polite">
        {formatMonth(month)}
      </p>
      <Button
        variant="ghost"
        aria-label="Next month"
        disabled={atLatest}
        onClick={() => onChange(nextMonth(month))}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  )
}
