import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { throwIfError } from '../../../lib/dbError'
import {
  ExportRowSchema,
  MonthAnalyticsSchema,
  PendingRowSchema,
  type ExportRow,
  type MonthAnalytics,
  type PendingRow,
} from '../schemas'

/** Monthly numbers for a "YYYY-MM" IST month (aggregated in the database). */
export async function fetchMonthAnalytics(
  client: SupabaseClient,
  month: string,
): Promise<MonthAnalytics> {
  const { data, error } = await client.rpc('analytics_month', { p_month: month })
  throwIfError(error)
  return MonthAnalyticsSchema.parse(data)
}

/** Delivered but unpaid orders, all time, oldest first. */
export async function fetchPendingPayments(client: SupabaseClient): Promise<PendingRow[]> {
  const { data, error } = await client.rpc('pending_payments')
  throwIfError(error)
  return z.array(PendingRowSchema).parse(data)
}

/** Rows for the month's CSV export (orders delivered in the month). */
export async function fetchExportRows(client: SupabaseClient, month: string): Promise<ExportRow[]> {
  const { data, error } = await client.rpc('export_orders_csv_rows', { p_month: month })
  throwIfError(error)
  return z.array(ExportRowSchema).parse(data)
}
