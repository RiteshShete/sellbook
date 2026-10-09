import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { todayIST } from '../../../lib/dates'
import { throwIfError } from '../../../lib/dbError'
import { uuid } from '../../../lib/id'
import {
  BillSchema,
  BillSourceSchema,
  type Bill,
  type BillSource,
  type BillState,
} from '../schemas'

const BUCKET = 'bills'

/** SQLSTATE from register_bill_revision: the order changed after the image was rendered. */
export const BILL_STALE = 'SB410'

export class BillStaleError extends Error {
  constructor() {
    super('The order changed while the bill was being made. Try again.')
  }
}

/** Assigns the bill number (once) and returns exactly what to print, with its content hash. */
export async function reserveBill(client: SupabaseClient, orderId: string): Promise<BillSource> {
  const { data, error } = await client.rpc('reserve_bill_number', { p_order: orderId })
  throwIfError(error)
  return BillSourceSchema.parse(data)
}

/** Uploads a rendered bill. Paths are unique and files are never overwritten (no upsert). */
export async function uploadBillImage(
  client: SupabaseClient,
  ownerId: string,
  orderId: string,
  png: Blob,
): Promise<string> {
  // Storage policy requires <owner_id>/<yyyy>/<file>.
  const path = `${ownerId}/${todayIST().slice(0, 4)}/bill-${orderId}-${uuid()}.png`
  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, png, { contentType: 'image/png', upsert: false })
  throwIfError(error)
  return path
}

export async function registerBill(
  client: SupabaseClient,
  orderId: string,
  path: string,
  hash: string,
): Promise<Bill> {
  const { data, error } = await client.rpc('register_bill_revision', {
    p_order: orderId,
    p_path: path,
    p_hash: hash,
  })
  if (error?.code === BILL_STALE) throw new BillStaleError()
  throwIfError(error)
  return BillSchema.parse(data)
}

export async function fetchBillState(client: SupabaseClient, orderId: string): Promise<BillState> {
  const [bills, hash] = await Promise.all([
    client
      .from('bills')
      .select('*')
      .eq('order_id', orderId)
      .order('revision', { ascending: false }),
    client.rpc('bill_content_hash', { p_order: orderId }),
  ])
  throwIfError(bills.error)
  throwIfError(hash.error)
  return { bills: z.array(BillSchema).parse(bills.data), currentHash: z.string().parse(hash.data) }
}

/** Private bucket: download with the owner's session (never a public URL). */
export async function downloadBillImage(client: SupabaseClient, path: string): Promise<Blob> {
  const { data, error } = await client.storage.from(BUCKET).download(path)
  throwIfError(error)
  return z.instanceof(Blob).parse(data)
}
