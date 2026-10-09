import type { SupabaseClient } from '@supabase/supabase-js'
import { formatDate, todayIST } from '../../lib/dates'
import { downloadAsset } from '../settings/api/settingsApi'
import type { Settings } from '../settings/schemas'
import { BillStaleError, registerBill, reserveBill, uploadBillImage } from './api/billsApi'
import { blobToDataUrl } from './render/billFonts'
import type { BillData } from './render/BillTemplate'
import { MAX_BILL_LINES, formatBillNo, type Bill } from './schemas'

export interface GeneratedBill {
  bill: Bill
  png: Blob
}

async function assetDataUrl(client: SupabaseClient, path: string | null): Promise<string | null> {
  return path ? blobToDataUrl(await downloadAsset(client, path)) : null
}

/**
 * Reserve the bill number -> render the PNG -> upload -> register it as the next revision.
 * If the order is edited mid-way (hash mismatch), renders once more from the fresh data.
 */
export async function generateBill(
  client: SupabaseClient,
  settings: Settings,
  orderId: string,
): Promise<GeneratedBill> {
  const [logo, qr, { renderBill }] = await Promise.all([
    assetDataUrl(client, settings.logo_path),
    assetDataUrl(client, settings.qr_path),
    import('./render/renderBill'), // html-to-image stays out of the main bundle
  ])

  for (let attempt = 0; ; attempt++) {
    const source = await reserveBill(client, orderId)
    if (source.items.length > MAX_BILL_LINES) {
      throw new Error(`A bill can have up to ${MAX_BILL_LINES} lines.`)
    }
    const data: BillData = {
      source,
      billNo: formatBillNo(source.bill_prefix ?? settings.bill_prefix, source.bill_no),
      date: formatDate(todayIST()),
      shop: {
        name: settings.shop_name,
        address: settings.shop_address,
        phone: settings.shop_phone,
        footer: settings.bill_footer,
        upiId: settings.upi_id,
      },
      logo,
      qr,
    }
    const png = await renderBill(data)
    const path = await uploadBillImage(client, settings.owner_id, orderId, png)
    try {
      return { bill: await registerBill(client, orderId, path, source.content_hash), png }
    } catch (e) {
      // The uploaded file stays (bill files are immutable); it is simply never referenced.
      if (e instanceof BillStaleError && attempt === 0) continue
      throw e
    }
  }
}
