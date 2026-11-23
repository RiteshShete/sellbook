import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { thumbPath } from '../../../lib/imageResize'
import {
  AddressRowSchema,
  CustomerOrderSchema,
  CustomerOrdersListResponse,
  PlaceOrderRequest,
  PlaceOrderResponse,
  StorefrontCatalogSchema,
  StorefrontShopResponse,
  UpsertAddressRequest,
} from '../contract'
import { customerErrorMessage } from '../errors'
import type { CustomerOrder, OrderSummary, StoreCatalog, StoreShop } from '../types'

/** A failed storefront call: `message` is already a sentence for the customer, `code` is the SB4xx code. */
export class StoreError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
  }
}

function fail(error: { code?: string; message: string }): never {
  throw new StoreError(customerErrorMessage(error), error.code ?? '')
}

/** null = no such shop, an unpublished one, or a reserved word: all look the same (nothing is revealed). */
export async function fetchStoreShop(client: SupabaseClient, slug: string): Promise<StoreShop | null> {
  const { data, error } = await client.rpc('storefront_shop', { p_slug: slug })
  if (error) fail(error)
  return StorefrontShopResponse.parse(data)
}

export async function fetchStoreCatalog(client: SupabaseClient, slug: string): Promise<StoreCatalog | null> {
  const { data, error } = await client.rpc('storefront_catalog', { p_slug: slug })
  if (error) fail(error)
  return StorefrontCatalogSchema.nullable().parse(data)
}

/** The browser sends only variant ids and quantities (the schema rejects anything else); the server prices the order. */
export async function placeOrder(client: SupabaseClient, request: z.input<typeof PlaceOrderRequest>) {
  const body = PlaceOrderRequest.parse(request)
  const { data, error } = await client.rpc('place_order', { p: body })
  if (error) fail(error)
  return PlaceOrderResponse.parse(data)
}

export async function fetchMyOrders(client: SupabaseClient, slug: string): Promise<OrderSummary[]> {
  const { data, error } = await client.rpc('customer_orders_list', { p_slug: slug, p_limit: 30 })
  if (error) fail(error)
  return CustomerOrdersListResponse.parse(data)
}

export async function fetchOrder(client: SupabaseClient, id: string): Promise<CustomerOrder> {
  const { data, error } = await client.rpc('customer_order_get', { p_order_id: id })
  if (error) fail(error)
  return CustomerOrderSchema.parse(data)
}

export async function cancelMyOrder(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc('cancel_my_order', { p_order_id: id })
  if (error) fail(error)
}

export async function fetchAddresses(client: SupabaseClient) {
  const { data, error } = await client
    .from('customer_addresses')
    .select('id, label, name, phone, line1, line2, area, city, pincode, landmark, is_default')
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('created_at')
  if (error) fail(error)
  return z.array(AddressRowSchema).parse(data)
}

export async function saveAddress(client: SupabaseClient, address: z.input<typeof UpsertAddressRequest>): Promise<void> {
  const { error } = await client.rpc('upsert_address', { p: UpsertAddressRequest.parse(address) })
  if (error) fail(error)
}

/** Product and logo pictures are public files; the grid asks for the small one. */
export const imageUrl = (client: SupabaseClient, path: string, thumb = false): string =>
  client.storage.from('catalog').getPublicUrl(thumb ? thumbPath(path) : path).data.publicUrl
