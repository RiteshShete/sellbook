import { Download } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Page } from '../../app/Page'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { formatMonth, formatMonthShort, isMonthKey, isoMonth, previousMonth } from '../../lib/dates'
import { useSettings } from '../settings/hooks/useSettings'
import { Breakdown } from './components/Breakdown'
import { DailyChart } from './components/DailyChart'
import { KpiGrid } from './components/KpiGrid'
import { MonthPicker } from './components/MonthPicker'
import { PaymentSplit } from './components/PaymentSplit'
import { useExportCsv, useMonthAnalytics } from './hooks/useAnalytics'
import { isQuietMonth } from './schemas'

/** Monthly analytics (IST months). The month lives in the URL: /analytics?month=2026-09. */
export function AnalyticsPage() {
  const [params, setParams] = useSearchParams()
  const latest = isoMonth(new Date())
  const asked = params.get('month') ?? ''
  const month = isMonthKey(asked) && asked <= latest ? asked : latest
  const prevMonth = previousMonth(month)

  const current = useMonthAnalytics(month, { keepPrevious: true })
  const previous = useMonthAnalytics(prevMonth)
  const settings = useSettings()
  const exportCsv = useExportCsv()

  const pick = (m: string) => setParams(m === latest ? {} : { month: m }, { replace: true })

  const csvButton = (
    <button
      type="button"
      aria-label="Download CSV"
      disabled={!settings.data || exportCsv.isPending}
      onClick={() =>
        settings.data && exportCsv.mutate({ month, billPrefix: settings.data.bill_prefix })
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
    <Page title="Analytics" action={headerActions}>
      <div className="flex flex-col gap-4">
        <MonthPicker
          month={month}
          latest={latest}
          onChange={pick}
          className="flex min-[360px]:hidden"
        />
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
