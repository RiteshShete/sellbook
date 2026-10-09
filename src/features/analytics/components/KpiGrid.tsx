import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { pluralize } from '../../../lib/format'
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
 * Card fills from docs/DESIGN.md: teal = the featured number (white text), lavender / peach =
 * brand cards (ink text), cream = secondary cards. Never the same brand colour twice in a row.
 */
type Tone = 'teal' | 'lavender' | 'peach' | 'cream'
const TONE: Record<Tone, { card: string; sub: string }> = {
  teal: { card: 'bg-teal text-white', sub: 'text-white/75' },
  lavender: { card: 'bg-lavender text-text', sub: 'text-text/70' },
  peach: { card: 'bg-peach text-text', sub: 'text-text/70' },
  cream: { card: 'bg-surface-2 text-text', sub: 'text-muted' },
}

/** Headline numbers for the month, each with its change vs the previous month. */
export function KpiGrid({ current: c, previous: p, previousLabel }: Props) {
  const delta = (pick: (a: MonthAnalytics) => number) =>
    p ? percentChange(pick(c), pick(p)) : undefined

  return (
    <div className="grid grid-cols-2 gap-3">
      <Kpi tone="teal" label="Sales" value={formatINR(c.sales)} wide>
        <Delta change={delta((a) => a.sales)} vs={previousLabel} tone="teal" />
      </Kpi>
      <Kpi tone="cream" label="Orders" value={String(c.orders)}>
        <Delta change={delta((a) => a.orders)} vs={previousLabel} tone="cream" />
      </Kpi>
      <Kpi tone="cream" label="Units" value={String(c.units)}>
        <Delta change={delta((a) => a.units)} vs={previousLabel} tone="cream" />
      </Kpi>
      <Kpi tone="cream" label="Avg order value" value={formatINR(c.aov)}>
        <Delta change={delta((a) => a.aov)} vs={previousLabel} tone="cream" />
      </Kpi>
      <Kpi tone="lavender" label="Collected" value={formatINR(c.collected)}>
        <Delta change={delta((a) => a.collected)} vs={previousLabel} tone="lavender" />
      </Kpi>
      <Link
        to="/pending"
        className={`col-span-2 flex min-h-14 items-center justify-between gap-3 rounded-3xl p-5 ${TONE.peach.card}`}
      >
        <span>
          <span className={`block text-sm ${TONE.peach.sub}`}>Outstanding (all time)</span>
          <span className="font-display text-2xl tabular-nums">
            {formatINR(c.outstanding_total)}
          </span>
          <span className={`ml-2 text-sm ${TONE.peach.sub}`}>
            {pluralize(c.outstanding_count, 'unpaid order')}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0" />
      </Link>
    </div>
  )
}

function Kpi(props: {
  tone: Tone
  label: string
  value: string
  wide?: boolean
  children: ReactNode
}) {
  const t = TONE[props.tone]
  return (
    <div className={`rounded-3xl p-5 ${t.card} ${props.wide ? 'col-span-2' : ''}`}>
      <p className={`text-sm ${t.sub}`}>{props.label}</p>
      <p className={`font-display tabular-nums break-words ${props.wide ? 'text-4xl' : 'text-xl'}`}>
        {props.value}
      </p>
      {props.children}
    </div>
  )
}

/**
 * "▲ +12% vs Sep": icon and sign carry the direction. Green/red only on cream cards; on brand
 * fills the card's own text colour keeps contrast.
 */
function Delta(props: { change: number | null | undefined; vs: string; tone: Tone }) {
  const { change, vs, tone } = props
  const sub = TONE[tone].sub
  if (change === undefined) return null
  if (change === null) return <p className={`mt-1 text-xs ${sub}`}>n/a vs {vs}</p>
  const up = change >= 0
  const Icon = up ? TrendingUp : TrendingDown
  const color = tone === 'cream' ? (up ? 'text-success' : 'text-danger') : ''
  return (
    <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${color}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>
        {up ? '+' : ''}
        {change}% <span className={`font-normal ${sub}`}>vs {vs}</span>
      </span>
    </p>
  )
}
