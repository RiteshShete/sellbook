import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { throwIfError } from '../../../lib/dbError'
import { uuid } from '../../../lib/id'
import {
  FULL_SIZE,
  LOGO_SIZE,
  THUMB_SIZE,
  fileExtension,
  resizeImage,
  thumbPath,
  type ResizeSpec,
} from '../../../lib/imageResize'
import { fromPaise } from '../../../lib/money'
import {
  OfferVariantSchema,
  OnlineDetailsSchema,
  PublishResultSchema,
  SHOP_COLUMNS,
  ShopSchema,
  type OfferVariant,
  type OnlineDetails,
  type PublishResult,
  type Shop,
} from '../schemas'
import { BulkOfferRequest, UpdateShopRequest } from '../../storefront/contract'

export async function fetchShop(client: SupabaseClient): Promise<Shop | null> {
  const { data, error } = await client.from('shops').select(SHOP_COLUMNS).maybeSingle()
  throwIfError(error)
  return data === null ? null : ShopSchema.parse(data)
}

/** Money in the patch is integer paise; the database takes rupees. */
export async function updateShop(client: SupabaseClient, patch: z.input<typeof UpdateShopRequest>): Promise<void> {
  const p = UpdateShopRequest.parse(patch)
  const body = {
    ...p,
    ...(p.delivery_fee !== undefined && { delivery_fee: fromPaise(p.delivery_fee) }),
    ...(p.min_order !== undefined && { min_order: fromPaise(p.min_order) }),
    ...(p.free_delivery_above !== undefined && {
      free_delivery_above: p.free_delivery_above === null ? null : fromPaise(p.free_delivery_above),
    }),
  }
  const { error } = await client.rpc('update_shop', { p: body })
  throwIfError(error)
}

export async function setPublished(client: SupabaseClient, publish: boolean): Promise<PublishResult> {
  const { data, error } = await client.rpc('set_shop_published', { p: publish })
  throwIfError(error)
  return PublishResultSchema.parse(data)
}

export async function fetchOfferVariants(client: SupabaseClient): Promise<OfferVariant[]> {
  const { data, error } = await client
    .from('variants')
    .select(
      'id, name, size_amount, size_unit, price, offer_price, offer_label, offer_starts_at, offer_ends_at, products!inner(id, name, is_active, sort_order)',
    )
    .is('deleted_at', null)
    .is('products.deleted_at', null)
  throwIfError(error)
  return z
    .array(OfferVariantSchema)
    .parse(data)
    .sort((a, b) => a.products.sort_order - b.products.sort_order || a.products.name.localeCompare(b.products.name))
}

/** Several variants, one percent or amount off, one date range (inclusive IST dates). Amount is in paise. */
export async function bulkOffer(client: SupabaseClient, input: z.input<typeof BulkOfferRequest>): Promise<number> {
  const r = BulkOfferRequest.parse(input)
  const body = { ...r, ...(r.amount_off !== undefined && { amount_off: fromPaise(r.amount_off) }) }
  const { data, error } = await client.rpc('bulk_offer', { p: body })
  throwIfError(error)
  return z.number().parse(data)
}

/** null = every offer of the shop. */
export async function endOffers(client: SupabaseClient, variantIds: string[] | null): Promise<number> {
  const { data, error } = await client.rpc('end_offers', { p_variant_ids: variantIds })
  throwIfError(error)
  return z.number().parse(data)
}

// ---- Product online details and pictures ------------------------------------------------------------------------------

const DETAIL_COLUMNS = 'description, ingredients, allergens, veg_type, shelf_life, is_available, image_paths'

export async function fetchOnlineDetails(client: SupabaseClient, productId: string): Promise<OnlineDetails> {
  const { data, error } = await client.from('products').select(DETAIL_COLUMNS).eq('id', productId).single()
  throwIfError(error)
  return OnlineDetailsSchema.parse(data)
}

/** One product row: a single-row write, so it goes straight to the table (row-level security and the plan guard apply). */
export async function saveOnlineDetails(
  client: SupabaseClient,
  productId: string,
  patch: Partial<OnlineDetails>,
): Promise<void> {
  const { error } = await client.from('products').update(patch).eq('id', productId)
  throwIfError(error)
}

const STORAGE_FULL = 'Could not upload the picture. Your storage may be full, or your plan has ended.'

/** Uploads a resized picture (and its thumbnail for product pictures). Returns the path of the full size. */
export async function uploadCatalogImage(
  client: SupabaseClient,
  ownerId: string,
  folder: string,
  file: File,
  kind: 'product' | 'logo',
): Promise<string> {
  const spec: ResizeSpec = kind === 'logo' ? LOGO_SIZE : FULL_SIZE
  const full = await resizeImage(file, spec)
  const thumb = kind === 'product' ? await resizeImage(file, THUMB_SIZE) : null
  const path = `${ownerId}/${folder}/${uuid()}.${fileExtension(full.type)}`
  const bucket = client.storage.from('catalog')
  // Names are random and never reused, so the browser may keep each picture for a year.
  const opts = (b: Blob) => ({ contentType: b.type, cacheControl: '31536000' })
  const up = await bucket.upload(path, full, opts(full))
  if (up.error) throw new Error(STORAGE_FULL)
  if (thumb) {
    const upThumb = await bucket.upload(thumbPath(path), thumb, opts(thumb))
    if (upThumb.error) {
      await bucket.remove([path])
      throw new Error(STORAGE_FULL)
    }
  }
  return path
}

export async function removeCatalogImages(client: SupabaseClient, paths: string[], withThumbs: boolean): Promise<void> {
  if (paths.length === 0) return
  const all = withThumbs ? paths.flatMap((p) => [p, thumbPath(p)]) : paths
  const { error } = await client.storage.from('catalog').remove(all)
  if (error) throw new Error('Could not remove the picture. Try again.')
}

export const catalogImageUrl = (client: SupabaseClient, path: string): string =>
  client.storage.from('catalog').getPublicUrl(path).data.publicUrl
