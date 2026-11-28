import { Download } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Page } from '../../app/Page'
import { EmptyState, ErrorState, SegmentedControl, Skeleton } from '../../components/ui'
import { formatMonth, formatMonthShort, isMonthKey, isoMonth, previousMonth } from '../../lib/dates'
import { usePro } from '../plan/hooks/usePlan'
import { useSettings } from '../settings/hooks/useSettings'
import { Breakdown } from './components/Breakdown'
import { DailyChart } from './components/DailyChart'
import { KpiGrid } from './components/KpiGrid'
import { MonthPicker } from './components/MonthPicker'
import { PaymentSplit } from './components/PaymentSplit'
import { useExportCsv, useMonthAnalytics } from './hooks/useAnalytics'
import { isQuietMonth, type SalesSource } from './schemas'

/**
 * Monthly reports (IST months), the second view of the Money screen. The month lives in the URL:
 * /analytics?view=reports&month=2026-09. `tabs` is the Pending/Reports switch the Money screen puts on top.
 */
export function AnalyticsReports({ tabs }: { tabs: ReactNode }) {
  const [params, setParams] = useSearchParams()
  const latest = isoMonth(new Date())
  const asked = params.get('month') ?? ''
  // Other months, the comparison and the CSV are Pro; other plans always see the current month.
  const pro = usePro()
  const month = pro && isMonthKey(asked) && asked <= latest ? asked : latest
  const prevMonth = previousMonth(month)

  const askedSource = params.get('source')
  const source: SalesSource | undefined = askedSource === 'owner' || askedSource === 'customer' ? askedSource : undefined
  const current = useMonthAnalytics(month, { keepPrevious: true, source })
  const previous = useMonthAnalytics(prevMonth, { enabled: pro === true, source })
  const settings = useSettings()
  const exportCsv = useExportCsv()

  // Every change keeps view=reports, or the Money screen would fall back to Pending.
  const keep = (next: Record<string, string>) =>
    setParams({ view: 'reports', ...(source ? { source } : {}), ...next }, { replace: true })
  const pick = (m: string) => keep(m === latest ? {} : { month: m })
  const pickSource = (v: 'all' | SalesSource) => {
    const next: Record<string, string> = month === latest ? { view: 'reports' } : { view: 'reports', month }
    setParams(v === 'all' ? next : { ...next, source: v }, { replace: true })
  }

  const csvButton = (
    <button
      type="button"
      aria-label="Download CSV"
      disabled={!settings.data || exportCsv.isPending}
      onClick={() =>
        settings.data && exportCsv.mutate({ month, billPrefix: settings.data.bill_prefix, source })
      }
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold active:bg-surface-2 disabled:opacity-50"
    >
      <Download className="h-5 w-5" />
      <span className="max-[359px]:sr-only">{exportCsv.isPending ? 'Saving…' : 'CSV'}</span>
    </button>
  )

  // The month pill sits in the header; phones narrower than 360px get it under the title instead.
  const headerActions = (
    <div className="flex items-center gap-3">
      <MonthPicker
        month={month}
        latest={latest}
        onChange={pick}
        className="hidden min-[360px]:flex"
      />
      {csvButton}
    </div>
  )

  return (
    <Page title="Money" action={pro ? headerActions : undefined}>
      <div className="flex flex-col gap-4">
        {tabs}
        <SegmentedControl
          label="Where the order came from"
          value={source ?? 'all'}
          onChange={pickSource}
          options={[
            { value: 'all', label: 'All orders' },
            { value: 'owner', label: 'Added by me' },
            { value: 'customer', label: 'Online shop' },
          ]}
        />
        {pro ? (
          <MonthPicker
            month={month}
            latest={latest}
            onChange={pick}
            className="flex min-[360px]:hidden"
          />
        ) : (
          pro === false && (
            <p className="text-sm text-muted">
              {formatMonth(month)}. Other months, comparison and CSV export are Pro.{' '}
              <Link to="/plan" className="font-medium underline underline-offset-4">
                See plans
              </Link>
            </p>
          )
        )}
        {current.isPending ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Loading">
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-60 w-full" />
          </div>
        ) : current.isError ? (
          <ErrorState error={current.error} onRetry={() => void current.refetch()} />
        ) : (
          <div
            className={`flex flex-col gap-4 transition-opacity ${current.isPlaceholderData ? 'opacity-50' : ''}`}
            aria-busy={current.isPlaceholderData}
          >
            <KpiGrid
              current={current.data}
              previous={current.isPlaceholderData ? undefined : previous.data}
              previousLabel={formatMonthShort(prevMonth)}
            />
            {previous.isError && (
              <p className="text-sm text-muted">
                Could not load {formatMonth(prevMonth)} for comparison.{' '}
                <button
                  type="button"
                  className="min-h-11 font-medium underline underline-offset-4"
                  onClick={() => void previous.refetch()}
                >
                  Try again
                </button>
              </p>
            )}
            {isQuietMonth(current.data) ? (
              <EmptyState
                title={`No sales in ${formatMonth(month)}`}
                description="Delivered orders and payments marked paid this month show up here."
                action={
                  <Link to="/" className="font-medium underline underline-offset-4">
                    Go to Home
                  </Link>
                }
              />
            ) : (
              <>
                <DailyChart daily={current.data.daily} />
                <PaymentSplit a={current.data} />
                <Breakdown a={current.data} />
              </>
            )}
          </div>
        )}
      </div>
    </Page>
  )
}
