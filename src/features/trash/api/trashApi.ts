import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { throwIfError } from '../../../lib/dbError'
import { pluralize } from '../../../lib/format'
import { dbMoney } from '../../../lib/zodMoney'

export type TrashTab = 'orders' | 'products' | 'variants'

/** One row on the Trash screen, whatever its kind. */
export interface TrashRow {
  id: string
  title: string
  detail: string
  deleted_at: string
  amount: number | null
}

const DeletedAt = z.string()

const OrderRow = z.object({
  id: z.guid(),
  order_no: z.number().int(),
  customer_name: z.string(),
  total: dbMoney,
  deleted_at: DeletedAt,
})

const ProductRow = z.object({
  id: z.guid(),
  name: z.string(),
  deleted_at: DeletedAt,
  variants: z.array(z.object({ deleted_at: z.string().nullable() })),
})

/** Variants trashed on their own (their product is live); others come back with the product. */
const VariantRow = z.object({
  id: z.guid(),
  name: z.string(),
  price: dbMoney,
  deleted_at: DeletedAt,
  products: z.object({ name: z.string() }),
})

export async function fetchTrash(client: SupabaseClient, tab: TrashTab): Promise<TrashRow[]> {
  if (tab === 'orders') {
    const { data, error } = await client
      .from('orders')
      .select('id, order_no, customer_name, total, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(200)
    throwIfError(error)
    return z
      .array(OrderRow)
      .parse(data)
      .map((o) => ({
        id: o.id,
        title: `#${o.order_no} ${o.customer_name}`,
        detail: 'Order',
        deleted_at: o.deleted_at,
        amount: o.total,
      }))
  }
  if (tab === 'products') {
    const { data, error } = await client
      .from('products')
      .select('id, name, deleted_at, variants (deleted_at)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    throwIfError(error)
    return z
      .array(ProductRow)
      .parse(data)
      .map((p) => {
        const n = p.variants.filter((v) => v.deleted_at === p.deleted_at).length
        return {
          id: p.id,
          title: p.name,
          detail: `Product · ${pluralize(n, 'variant')} come back with it`,
          deleted_at: p.deleted_at,
          amount: null,
        }
      })
  }
  const { data, error } = await client
    .from('variants')
    .select('id, name, price, deleted_at, products!inner (name, deleted_at)')
    .not('deleted_at', 'is', null)
    .is('products.deleted_at', null)
    .order('deleted_at', { ascending: false })
  throwIfError(error)
  return z
    .array(VariantRow)
    .parse(data)
    .map((v) => ({
      id: v.id,
      title: `${v.products.name} · ${v.name}`,
      detail: 'Variant',
      deleted_at: v.deleted_at,
      amount: v.price,
    }))
}
