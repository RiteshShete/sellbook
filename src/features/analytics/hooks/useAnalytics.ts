import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { toast } from '../../../components/ui'
import { formatMonth } from '../../../lib/dates'
import { pluralize } from '../../../lib/format'
import { queryKeys } from '../../../lib/queryKeys'
import { downloadBlob } from '../../../lib/share'
import { useAuth } from '../../auth/useAuth'
import { fetchExportRows, fetchMonthAnalytics, fetchPendingPayments } from '../api/analyticsApi'
import { buildOrdersCsv, csvFileName } from '../exportCsv'

/**
 * `keepPrevious`: month arrows keep the old numbers (dimmed) until the new ones land. Off for the
 * comparison month, whose stale data would be labelled with the wrong month.
 */
export function useMonthAnalytics(month: string, { keepPrevious = false } = {}) {
  const { client } = useAuth()
  return useQuery({
    queryKey: queryKeys.analytics.month(month),
    queryFn: () => fetchMonthAnalytics(client, month),
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  })
}

export function usePendingPayments() {
  const { client } = useAuth()
  return useQuery({ queryKey: queryKeys.pending, queryFn: () => fetchPendingPayments(client) })
}

/** Downloads the month's delivered orders as CSV. */
export function useExportCsv() {
  const { client } = useAuth()
  return useMutation({
    mutationFn: async ({ month, billPrefix }: { month: string; billPrefix: string }) => {
      const rows = await fetchExportRows(client, month)
      if (rows.length > 0) {
        const csv = buildOrdersCsv(rows, billPrefix)
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), csvFileName(month))
      }
      return { month, count: rows.length }
    },
    onSuccess: ({ month, count }) => {
      if (count === 0) toast.info(`No delivered orders in ${formatMonth(month)} to export.`)
      else toast.success(`Saved ${pluralize(count, 'order')} for ${formatMonth(month)}.`)
    },
  })
}
