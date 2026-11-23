// @vitest-environment node
// C5: every public function's REAL JSON (from the local database) must satisfy the frozen zod contract, strictly.
// Skipped unless CONTRACT_URL and CONTRACT_ANON_KEY are set; run it with `npm run test:contract` (needs `supabase start`).
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  AddressRowSchema,
  CustomerOrderSchema,
  MyCustomersResponse,
  CustomerOrdersListResponse,
  DeclineOrderResponse,
  MyContextSchema,
  PlaceOrderResponse,
  SetShopPublishedResponse,
  SlugAvailableResponse,
  StorefrontCatalogSchema,
  StorefrontShopResponse,
  VerifyPaymentResponse,
} from './contract'

const URL_ = process.env.CONTRACT_URL
const KEY = process.env.CONTRACT_ANON_KEY
const psql = (sql: string) => execFileSync('docker', ['exec', 'supabase_db_sellbook', 'psql', '-U', 'postgres', '-At', '-c', sql], { encoding: 'utf8' }).trim()
const digits = () => Array.from(randomBytes(9), (b) => b % 10).join('')
const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)

describe.skipIf(!URL_ || !KEY)('SQL responses match the frozen contract', () => {
  const mk = () => createClient(URL_ as string, KEY as string, { auth: { persistSession: false, autoRefreshToken: false } })

  it('every response parses strictly', async () => {
    const [owner, cust, anon] = [mk(), mk(), mk()]
    const o = await owner.auth.signUp({ phone: `+919${digits()}`, password: 'Contract-pass-1' })
    const c = await cust.auth.signUp({ phone: `+919${digits()}`, password: 'Contract-pass-1' })
    const ownerId = o.data.user?.id ?? ''
    const code = randomUUID().replace(/-/g, '').slice(0, 10)
    psql(`insert into public.shop_invites (code, created_by) values ('${code}', '${ownerId}')`)
    const slug = `contract-${digits().slice(0, 5)}`

    expect(SlugAvailableResponse.parse((await anon.rpc('slug_available', { p_slug: slug })).data)).toBe(true)
    expect((await owner.rpc('create_shop', { p_invite: code, p_slug: slug, p_name: 'Contract Shop' })).error).toBeNull()
    MyContextSchema.parse((await owner.rpc('my_context')).data)

    const [prod, variant] = [randomUUID(), randomUUID()]
    psql(`update public.shops set lead_time_hours = 0, delivery_mode = 'both', pay_upi = true, pay_cod = true where owner_id = '${ownerId}'`)
    psql(`update public.shops set whatsapp = '919876543210' where owner_id = '${ownerId}'`)
    psql(`update auth.users set email = 'contract-${slug}@example.test', email_confirmed_at = now() where id = '${ownerId}'`)
    psql(`update public.settings set upi_id = 'shop@upi', payee_name = 'Contract Shop' where owner_id = '${ownerId}'`)
    psql(`insert into public.products (id, owner_id, name) values ('${prod}', '${ownerId}', 'Item')`)
    psql(`insert into public.variants (id, owner_id, product_id, name, price) values ('${variant}', '${ownerId}', '${prod}', 'Std', 250)`)

    const pub = await owner.rpc('set_shop_published', { p: true })
    expect(pub.error?.message ?? null).toBeNull()
    SetShopPublishedResponse.parse(pub.data)
    expect(StorefrontShopResponse.parse((await anon.rpc('storefront_shop', { p_slug: slug })).data)).not.toBeNull()
    expect(StorefrontShopResponse.parse((await anon.rpc('storefront_shop', { p_slug: 'no-such-shop-zz' })).data)).toBeNull()
    const cat = await anon.rpc('storefront_catalog', { p_slug: slug })
    expect(cat.error?.message ?? null).toBeNull()
    expect(StorefrontCatalogSchema.nullable().parse(cat.data)).not.toBeNull()

    expect((await cust.rpc('register_customer', { p_name: 'Asha', p_phone: c.data.user?.phone ?? '' })).error).toBeNull()
    const address = { name: 'Asha', phone: c.data.user?.phone ?? '', line1: '12 Market Rd', city: 'Pune', pincode: '411001' }
    const saved = await cust.rpc('upsert_address', { p: address })
    expect(saved.error).toBeNull()
    const rows = await cust.from('customer_addresses').select('id, label, name, phone, line1, line2, area, city, pincode, landmark, is_default').is('deleted_at', null)
    z.array(AddressRowSchema).parse(rows.data)

    const placed = await cust.rpc('place_order', { p: { slug, items: [{ variant_id: variant, qty: 2 }], fulfilment: 'pickup', payment_method: 'upi', requested_for: today, idempotency_key: randomUUID() } })
    expect(placed.error).toBeNull()
    const { order_id: id } = PlaceOrderResponse.parse(placed.data)

    CustomerOrdersListResponse.parse((await cust.rpc('customer_orders_list', { p_slug: slug })).data)
    CustomerOrderSchema.parse((await cust.rpc('customer_order_get', { p_order_id: id })).data)

    expect((await cust.rpc('claim_payment', { p_order_id: id, p_utr: '123456789012' })).error).toBeNull()
    CustomerOrderSchema.parse((await cust.rpc('customer_order_get', { p_order_id: id })).data)

    const v = Number(psql(`select version_no from public.orders where id = '${id}'`))
    expect((await owner.rpc('confirm_order', { p_id: id, p_note: null, v })).error).toBeNull()
    const v2 = Number(psql(`select version_no from public.orders where id = '${id}'`))
    VerifyPaymentResponse.parse((await owner.rpc('verify_payment', { p_id: id, v: v2 })).data)
    CustomerOrderSchema.parse((await cust.rpc('customer_order_get', { p_order_id: id })).data)

    const second = await cust.rpc('place_order', { p: { slug, items: [{ variant_id: variant, qty: 1 }], fulfilment: 'pickup', payment_method: 'cod', requested_for: today, idempotency_key: randomUUID() } })
    const sid = PlaceOrderResponse.parse(second.data).order_id
    const v3 = Number(psql(`select version_no from public.orders where id = '${sid}'`))
    DeclineOrderResponse.parse((await owner.rpc('decline_order', { p_id: sid, p_reason: 'Sold out', v: v3 })).data)
    MyCustomersResponse.parse((await owner.rpc('my_customers')).data)
  })
})
