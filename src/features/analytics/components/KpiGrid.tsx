import { TrendingDown, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatINR } from '../../../lib/money'
import { percentChange, type MonthAnalytics } from '../schemas'

interface Props {
  current: MonthAnalytics
  /** Previous month, for the deltas; undefined while it loads or if it failed. */
  previous: MonthAnalytics | undefined
  /** "Sep" */
  previousLabel: string
}

/**
 * Figma "Code - /analytics": three featured cards (Sales green, Outstanding magenta, Collected
 * blue) with white text, the rest cream. Featured values are bigger on Sales and Outstanding.
 */
type Tone = 'sales' | 'outstanding' | 'collected' | 'cream'
const TONE: Record<Tone, { card: string; label: string; featured: boolean }> = {
  sales: {
    card: 'bg-kpi-sales text-white',
    label: 'text-base font-semibold max-[359px]:text-sm',
    featured: true,
  },
  outstanding: {
    card: 'bg-kpi-outstanding text-white',
    label: 'text-base font-semibold max-[359px]:text-sm',
    featured: true,
  },
  collected: {
    card: 'bg-kpi-collected text-white',
    label: 'text-base font-semibold max-[359px]:text-sm',
    featured: true,
  },
  cream: { card: 'bg-surface-2 text-text', label: 'text-sm text-muted', featured: false },
}

/** Headline numbers for the month, each with its change vs the previous month. */
export function KpiGrid({ current: c, previous: p, previousLabel }: Props) {
  const delta = (pick: (a: MonthAnalytics) => number) =>
    p ? percentChange(pick(c), pick(p)) : undefined
  const change = (tone: Tone, pick: (a: MonthAnalytics) => number) => (
    <Delta change={delta(pick)} vs={previousLabel} tone={tone} />
  )

  return (
    <div className="grid grid-cols-2 gap-3">
      <Kpi
        tone="sales"
        label="Sales"
        value={formatINR(c.sales)}
        big
        aside={change('sales', (a) => a.sales)}
      />
      <Link
        to="/pending"
        aria-label={`Outstanding, all time: ${formatINR(c.outstanding_total)}, ${c.outstanding_count} unpaid. Open pending payments`}
        className="flex min-w-0"
      >
        <Kpi
          tone="outstanding"
          label="Outstanding (all time)"
          value={formatINR(c.outstanding_total)}
          big
          aside={
            <span className="shrink-0 text-right text-sm leading-tight font-medium">
              {c.outstanding_count}
              <br />
              unpaid
            </span>
          }
        />
      </Link>
      <Kpi
        tone="cream"
        label="Orders"
        value={String(c.orders)}
        aside={change('cream', (a) => a.orders)}
      />
      <Kpi
        tone="cream"
        label="Units"
        value={String(c.units)}
        aside={change('cream', (a) => a.units)}
      />
      <Kpi
        tone="cream"
        label="Avg order value"
        value={formatINR(c.aov)}
        aside={change('cream', (a) => a.aov)}
      />
      <Kpi
        tone="collected"
        label="Collected"
        value={formatINR(c.collected)}
        aside={change('collected', (a) => a.collected)}
      />
    </div>
  )
}

function Kpi(props: {
  tone: Tone
  label: string
  value: string
  /** Sales and Outstanding use the 36px number; the rest 28px. */
  big?: boolean
  /** Top-right corner: the change vs last month, or the unpaid count. */
  aside?: ReactNode
}) {
  const t = TONE[props.tone]
  return (
    <div className={`flex w-full min-w-0 flex-col gap-4 rounded-3xl px-3 py-4 ${t.card}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`min-w-0 ${t.label}`}>{props.label}</p>
        {props.aside}
      </div>
      <p
        className={`font-display tabular-nums break-words ${props.big ? 'text-4xl' : 'text-[28px] leading-7'}`}
      >
        {props.value}
      </p>
    </div>
  )
}

/**
 * "↘ -92%": icon and sign carry the direction (the month it is compared with is read out for
 * screen readers). Green/red only on cream cards; on brand fills the card's white keeps contrast.
 */
function Delta(props: { change: number | null | undefined; vs: string; tone: Tone }) {
  const { change, vs, tone } = props
  if (change === undefined) return null
  if (change === null) return <p className="shrink-0 pt-1 text-xs">n/a</p>
  const up = change >= 0
  const Icon = up ? TrendingUp : TrendingDown
  const color = tone === 'cream' ? (up ? 'text-success-ink' : 'text-danger-ink') : ''
  return (
    <p className={`flex shrink-0 items-center gap-1 pt-1 text-xs font-semibold ${color}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>
        {up ? '+' : ''}
        {change}%<span className="sr-only"> vs {vs}</span>
      </span>
    </p>
  )
}
