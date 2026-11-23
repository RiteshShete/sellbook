import { Check } from 'lucide-react'
import { useState } from 'react'
import { Page } from '../../app/Page'
import { Button, ErrorState, Skeleton } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { formatBytes } from '../../lib/format'
import { formatINR } from '../../lib/money'
import { PayPanel, RequestStatus } from './components/PayPanel'
import { useExportMyData, usePlan, usePlanLimits } from './hooks/usePlan'
import { PRO_FEATURES, TIER_LABEL, type Plan, type PlanLimit } from './schemas'

const STATUS_TEXT: Record<Plan['status'], string> = {
  trial: 'Free trial',
  active: 'Active',
  grace_readonly: 'Ended: read-only',
  locked: 'Ended: locked',
}

/** "Your plan": what the shop is on, how much of it is used, and what each plan offers. */
export function PlanPage() {
  const plan = usePlan()
  const limits = usePlanLimits()
  const [paying, setPaying] = useState<PlanLimit | null>(null)

  return (
    <Page title="Your plan" back="/more">
      {plan.isPending || limits.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : plan.isError || limits.isError ? (
        <ErrorState
          error={plan.error ?? limits.error}
          onRetry={() => void Promise.all([plan.refetch(), limits.refetch()])}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Current plan={plan.data} />
          <RequestStatus plan={plan.data} />
          <h2 className="mt-2 font-display text-xl">Plans</h2>
          {limits.data.map((l) => (
            <TierCard
              key={l.tier}
              limit={l}
              current={l.tier === plan.data.tier}
              onPay={canPay(plan.data, l) ? () => setPaying(l) : undefined}
            />
          ))}
          <PayPanel plan={plan.data} limit={paying} onClose={() => setPaying(null)} />
          <YourData />
        </div>
      )}
    </Page>
  )
}

/** A paid tier can be bought unless a payment is already waiting, or it would be a downgrade from running Pro. */
function canPay(plan: Plan, limit: PlanLimit): boolean {
  if (limit.tier === 'trial' || plan.request?.status === 'pending') return false
  const proRunning = plan.tier === 'pro' && plan.status === 'active'
  return !(proRunning && limit.tier === 'base')
}

function Current({ plan }: { plan: Plan }) {
  const ended = plan.status === 'grace_readonly' || plan.status === 'locked'
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface-2 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl">{plan.tier ? TIER_LABEL[plan.tier] : 'No plan'}</h2>
        {/* On the trial the title already says it. */}
        {plan.status !== 'trial' && (
          <span className={`text-sm font-medium ${ended ? 'text-danger-ink' : 'text-muted'}`}>
            {STATUS_TEXT[plan.status]}
          </span>
        )}
      </div>
      {plan.ends_at && (
        <p className="text-sm text-muted">
          {ended ? 'Ended' : 'Runs until'} {formatDate(plan.ends_at)}
          {plan.status === 'grace_readonly' && plan.readonly_until
            ? `. You can read your data; from ${formatDate(plan.readonly_until)} the shop is locked until you renew.`
            : ''}
        </p>
      )}
      <UsageMeter
        label={plan.limits.orders_scope === 'month' ? 'Orders this month' : 'Orders'}
        used={plan.usage.orders}
        limit={plan.limits.orders}
      />
      <UsageMeter label="Products" used={plan.usage.products} limit={plan.limits.products} />
      <UsageMeter
        label="Bill pictures"
        used={plan.storage.used}
        limit={plan.storage.limit}
        format={formatBytes}
      />
      {plan.storage.keep_days !== null && (
        <p className="text-sm text-muted">
          Bill pictures are kept {plan.storage.keep_days} days, then removed to save space. The bill stays and you can
          make the picture again any time, with the same bill number.
        </p>
      )}
    </section>
  )
}

function UsageMeter(props: {
  label: string
  used: number
  limit: number | null
  /** How a number is shown (bytes for storage); counts by default. */
  format?: (n: number) => string
}) {
  const { label, used, limit, format = String } = props
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / limit) * 100))
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums">
          {limit === null ? `${format(used)} · no limit` : `${format(used)} of ${format(limit)}`}
        </span>
      </div>
      {limit !== null && (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          aria-valuetext={`${format(used)} of ${format(limit)}`}
          className="mt-1 h-2 overflow-hidden rounded-full bg-surface"
        >
          <div className={`h-full rounded-full ${pct >= 80 ? 'bg-danger' : 'bg-teal'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

function TierCard(props: { limit: PlanLimit; current: boolean; onPay?: () => void }) {
  const { limit, current, onPay } = props
  const orders =
    limit.orders_limit === null
      ? 'Unlimited orders'
      : `${limit.orders_limit} orders ${limit.orders_scope === 'month' ? 'a month' : 'in total'}`
  const products = limit.products_limit === null ? 'Unlimited products' : `${limit.products_limit} products`
  const storage =
    limit.storage_bytes === null
      ? []
      : [`${formatBytes(limit.storage_bytes)} of bill pictures, kept ${limit.bill_keep_days ?? 0} days`]
  const points = [orders, products, ...storage, ...(limit.pro_features ? PRO_FEATURES : [])]
  return (
    <section className={`rounded-2xl border bg-surface p-4 ${current ? 'border-text' : 'border-border'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg">
          {TIER_LABEL[limit.tier]}
          {current && <span className="ml-2 text-sm font-normal text-muted">Your plan</span>}
        </h3>
        <span className="font-semibold tabular-nums">
          {limit.price_paise === 0 ? `Free for ${limit.period_days} days` : `${formatINR(limit.price_paise)} a month`}
        </span>
      </div>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
            {p}
          </li>
        ))}
      </ul>
      {onPay && (
        <Button block className="mt-3" variant={current ? 'secondary' : 'primary'} onClick={onPay}>
          {current ? 'Renew' : 'Choose'} {TIER_LABEL[limit.tier]} · {formatINR(limit.price_paise)}
        </Button>
      )}
    </section>
  )
}

/** Taking your data with you: one file with everything entered (also what the Privacy page promises). */
function YourData() {
  const save = useExportMyData()
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-display text-lg">Your data</h2>
      <p className="text-sm text-muted">
        Save everything you have entered (products, orders, bills and settings) as one file. Do it now and then as
        your own backup.
      </p>
      <Button variant="secondary" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? 'Saving…' : 'Download my data'}
      </Button>
    </section>
  )
}
