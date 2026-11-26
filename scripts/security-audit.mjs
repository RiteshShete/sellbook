// Storefront security audit (STOREFRONT_PLAN 16.2), run against the LOCAL stack only. It creates two shops and three customers,
// then tries to read, change and abuse each other's data the way an attacker with only the public (anon) key could, and checks
// the database and storage settings. Prints PASS / FAIL per check; exits 1 if anything fails.
//
//   $env:AUDIT_URL = 'http://127.0.0.1:54321'; $env:AUDIT_ANON_KEY = '<local anon key>'; node scripts/security-audit.mjs
//
// Refuses any URL that is not this machine. Uses the anon (public) key and the local database container for setup only.
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const { AUDIT_URL, AUDIT_ANON_KEY } = process.env
if (!AUDIT_URL || !AUDIT_ANON_KEY || !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(AUDIT_URL)) {
  console.error('Set AUDIT_URL (the LOCAL stack, http://127.0.0.1:54321) and AUDIT_ANON_KEY. Nothing was run.')
  process.exit(2)
}

const results = []
const check = (group, name, ok, detail = '') => {
  results.push({ group, name, ok: Boolean(ok), detail })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  [${group}] ${name}${ok || !detail ? '' : `  -  ${detail}`}`)
}
const psql = (sql) =>
  execFileSync('docker', ['exec', 'supabase_db_sellbook', 'psql', '-U', 'postgres', '-At', '-F', '|', '-c', sql], { encoding: 'utf8' }).trim()
const lines = (text) => (text === '' ? [] : text.split('\n'))
const client = () => createClient(AUDIT_URL, AUDIT_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const rnd = (n) => Array.from(randomBytes(n), (b) => b % 10).join('')
const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)

// ======================================================================================================================
console.log('\n1. Database and storage settings')
// ======================================================================================================================
check('rls', 'every public table has row-level security on', psql(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`) === '')
check('rls', 'anon holds no privilege on any public table', psql(`select table_name from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'`) === '')
check('rls', 'no policy is "true" for everyone (two read-only tables for signed-in users are allowed by design: plan prices, where shops pay)', psql(`select tablename || '.' || policyname from pg_policies where schemaname = 'public' and (qual = 'true' or with_check = 'true') and policyname not in ('plan_limits_select_all', 'platform_config_select_all')`) === '', psql(`select tablename || '.' || policyname from pg_policies where schemaname = 'public' and (qual = 'true' or with_check = 'true')`))

const anonFns = lines(psql(`select distinct routine_schema || '.' || routine_name from information_schema.routine_privileges where grantee = 'anon' and routine_schema in ('public', 'app_private') and privilege_type = 'EXECUTE' order by 1`))
const wanted = ['app_private.slug_available', 'app_private.storefront_catalog', 'app_private.storefront_shop', 'public.ping', 'public.slug_available', 'public.storefront_catalog', 'public.storefront_shop']
check('functions', 'anon can run only the public storefront functions and ping', JSON.stringify(anonFns) === JSON.stringify(wanted), anonFns.join(', '))

const authFns = lines(psql(`select distinct routine_name from information_schema.routine_privileges where grantee = 'authenticated' and routine_schema = 'public' and privilege_type = 'EXECUTE' order by 1`))
console.log(`  info  ${authFns.length} public functions are executable by signed-in users (listed in the audit document)`)

check('definer', 'every SECURITY DEFINER function has an empty, fixed search_path', psql(`select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'app_private') and p.prosecdef and not coalesce((select bool_or(c in ('search_path=""', 'search_path=') ) from unnest(p.proconfig) c), false)`) === '', psql(`select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'app_private') and p.prosecdef and not coalesce((select bool_or(c in ('search_path=""', 'search_path=') ) from unnest(p.proconfig) c), false)`))
check('definer', 'no SECURITY DEFINER function builds SQL from text (no EXECUTE)', psql(`select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'app_private') and p.prosecdef and p.prosrc ~* '\\mexecute\\M'`) === '')
const definerCount = psql(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'app_private') and p.prosecdef`)
console.log(`  info  ${definerCount} SECURITY DEFINER functions checked`)

const buckets = Object.fromEntries(lines(psql("select id || '|' || public || '|' || coalesce(file_size_limit::text, '') from storage.buckets")).map((l) => l.split('|')).map(([id, pub, limit]) => [id, { public: pub === 'true', limit }]))
check('storage', 'bills and assets are private; catalog is public with a 1 MB cap', buckets.bills?.public === false && buckets.assets?.public === false && buckets.catalog?.public === true && buckets.catalog?.limit === '1048576', JSON.stringify(buckets))
check('storage', 'no policy lets anon read or list storage objects', psql(`select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and 'anon' = any(roles)`) === '', psql(`select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and 'anon' = any(roles)`))

// ======================================================================================================================
console.log('\n2. Two shops, three customers: nobody sees or changes anyone else\'s data')
// ======================================================================================================================
async function newUser(label) {
  const c = client()
  const phone = `+919${rnd(9)}`
  const { data, error } = await c.auth.signUp({ phone, password: 'Audit-pass-1' })
  if (error || !data.user) throw new Error(`sign-up for ${label} failed: ${error?.message}`)
  return { c, id: data.user.id, phone, label, digits: phone.slice(1) }
}
async function newShop(label) {
  const u = await newUser(label)
  const invite = randomUUID().replace(/-/g, '').slice(0, 10)
  psql(`insert into public.shop_invites (code, created_by) values ('${invite}', '${u.id}')`)
  const slug = `audit-${label}-${rnd(4)}`
  const { error } = await u.c.rpc('create_shop', { p_invite: invite, p_slug: slug, p_name: `Audit ${label}` })
  if (error) throw new Error(`create_shop ${label}: ${error.message}`)
  const [prod, variant] = [randomUUID(), randomUUID()]
  psql(`update public.shops set is_published = true, whatsapp = '919876543210', lead_time_hours = 0, delivery_mode = 'both' where owner_id = '${u.id}'`)
  psql(`insert into public.products (id, owner_id, name) values ('${prod}', '${u.id}', 'Item ${label}')`)
  psql(`insert into public.variants (id, owner_id, product_id, name, price) values ('${variant}', '${u.id}', '${prod}', 'Std', 250)`)
  return { ...u, slug, variant }
}
async function newCustomer(label) {
  const u = await newUser(label)
  const { error } = await u.c.rpc('register_customer', { p_name: `Cust ${label}`, p_phone: u.digits })
  if (error) throw new Error(`register ${label}: ${error.message}`)
  return u
}
const order = (shop, key = randomUUID(), extra = {}) => ({
  slug: shop.slug, items: [{ variant_id: shop.variant, qty: 2 }], fulfilment: 'pickup', payment_method: 'cod',
  requested_for: today, idempotency_key: key, ...extra,
})

const A = await newShop('A')
const B = await newShop('B')
const [C1, C2, C3] = [await newCustomer('1'), await newCustomer('2'), await newCustomer('3')]
const place = async (cust, shop) => {
  const { data, error } = await cust.c.rpc('place_order', { p: order(shop) })
  if (error) throw new Error(`order ${cust.label} at ${shop.label}: ${error.message}`)
  return data.order_id
}
const o1 = await place(C1, A)
const o2 = await place(C2, A)
const o3 = await place(C3, B)

const count = async (u, table) => (await u.c.from(table).select('*')).data?.length ?? -1
const anon = client()

// -- visitors
const pub = await anon.rpc('storefront_shop', { p_slug: A.slug })
check('anon', 'a visitor can open a published shop through the public function', pub.data?.name === 'Audit A')
check('anon', 'the public shop JSON never contains the UPI ID, owner id or cost', !/upi_id|owner_id|cost_price/.test(JSON.stringify(pub.data) + JSON.stringify((await anon.rpc('storefront_catalog', { p_slug: A.slug })).data)))
for (const t of ['orders', 'products', 'customer_profiles', 'customer_addresses', 'shop_customers', 'shops', 'settings']) {
  const r = await anon.from(t).select('*')
  check('anon', `a visitor cannot read ${t}`, r.error !== null || (r.data?.length ?? 0) === 0, `${r.data?.length} rows`)
}

// -- customers
for (const [who, cust, mine] of [['customer 1', C1, o1], ['customer 2', C2, o2], ['customer 3', C3, o3]]) {
  check('customer', `${who} sees no orders, products, settings, shops or shop customers directly`, (await Promise.all(['orders', 'products', 'settings', 'shops', 'shop_customers', 'order_items'].map((t) => count(cust, t)))).every((n) => n === 0))
  const profiles = await cust.c.from('customer_profiles').select('user_id')
  check('customer', `${who} sees only their own profile`, profiles.data?.length === 1 && profiles.data[0]?.user_id === cust.id)
  const got = await cust.c.rpc('customer_order_get', { p_order_id: mine })
  check('customer', `${who} can open their own order`, got.data?.id === mine)
}
const missing = await C1.c.rpc('customer_order_get', { p_order_id: randomUUID() })
const foreign = await C1.c.rpc('customer_order_get', { p_order_id: o2 })
check('customer', "another customer's order looks exactly like a missing one", foreign.error?.message === missing.error?.message && foreign.error?.code === 'P0002', `${foreign.error?.message} / ${missing.error?.message}`)
const listB = await C1.c.rpc('customer_orders_list', { p_slug: B.slug })
check('customer', 'a customer\'s order list at another shop is empty (never that shop\'s other customers)', Array.isArray(listB.data) && listB.data.length === 0)
check('customer', 'a customer cannot claim, switch or cancel someone else\'s order', (await Promise.all([C1.c.rpc('claim_payment', { p_order_id: o2 }), C1.c.rpc('switch_to_cod', { p_order_id: o2 }), C1.c.rpc('cancel_my_order', { p_order_id: o2 })])).every((r) => r.error?.code === 'P0002'))

// -- shop owners
for (const [who, owner, mine, theirs] of [['shop A', A, 2, o3], ['shop B', B, 1, o1]]) {
  const orders = await owner.c.from('orders').select('id, customer_name, customer_phone')
  check('owner', `${who} sees only its own ${mine} order(s)`, orders.data?.length === mine && orders.data.every((o) => o.id !== theirs))
  check('owner', `${who} cannot read customer profiles or addresses (only the snapshots on its orders)`, (await count(owner, 'customer_profiles')) === 0 && (await count(owner, 'customer_addresses')) === 0)
  check('owner', `${who} sees only its own customers`, (await count(owner, 'shop_customers')) === mine)
  const hit = await owner.c.rpc('confirm_order', { p_id: theirs, p_note: null, v: 1 })
  check('owner', `${who} cannot confirm another shop's order`, hit.error?.code === 'P0002')
  const other = await owner.c.rpc('verify_payment', { p_id: theirs, v: 1 })
  check('owner', `${who} cannot verify another shop's payment`, other.error?.code === 'P0002')
}

// -- tampering
const tamper = await C1.c.rpc('place_order', { p: order(A, randomUUID(), { price: 1, total: 1, owner_id: B.id }) })
check('tamper', 'a price, total or owner id sent with an order is refused', tamper.error?.code === 'SB427', tamper.error?.message)
const cheap = await C1.c.rpc('place_order', { p: { ...order(A), items: [{ variant_id: A.variant, qty: 1, price: 1 }] } })
check('tamper', 'a price inside an order line is refused', cheap.error?.code === 'SB427')
const wrongShop = await C1.c.rpc('place_order', { p: { ...order(A), items: [{ variant_id: B.variant, qty: 1 }] } })
check('tamper', "another shop's product in this shop's order is refused", wrongShop.error?.code === 'SB422')
const insert = await C1.c.from('orders').insert({ owner_id: A.id, order_no: 999, customer_name: 'x' })
check('tamper', 'a customer cannot insert an order row directly', insert.error !== null)
const paid = await C1.c.from('orders').update({ payment_status: 'paid', payment_mode: 'online' }).eq('id', o1).select()
check('tamper', 'a customer cannot mark their own order paid by a direct update', paid.error !== null || (paid.data?.length ?? 0) === 0)
const aEdits = await A.c.from('orders').update({ total: 1 }).eq('id', o3).select()
check('tamper', "a shop cannot edit another shop's order by a direct update", aEdits.error !== null || (aEdits.data?.length ?? 0) === 0)
const rows = psql(`select payment_status::text, total::text from public.orders where id = '${o1}'`)
check('tamper', 'after all that, order 1 is still unpaid with its server-calculated total', rows === 'pending|500.00', rows)

// -- customers cannot be shop owners
const ownerFns = [['init_settings', {}], ['upsert_product', { p: { name: 'x', variants: [{ name: 'v', price: '1' }] } }], ['create_order', { p: { customer_name: 'x' } }],
  ['set_shop_published', { p: true }], ['update_shop', { p: { city: 'x' } }], ['bulk_offer', { p: {} }], ['my_customers', {}], ['admin_create_invite', { p_note: 'x' }],
  ['confirm_order', { p_id: o1, p_note: null, v: 1 }], ['verify_payment', { p_id: o1, v: 1 }], ['reject_payment', { p_id: o1, p_reason: 'x', v: 1 }]]
const denied = []
for (const [fn, args] of ownerFns) {
  const r = await C1.c.rpc(fn, args)
  if (!r.error) denied.push(`${fn} (allowed!)`)
}
check('roles', 'a customer-only account cannot run any owner or admin function', denied.length === 0, denied.join(', '))
check('roles', 'no shop, settings or subscription was created for the customer', psql(`select (select count(*) from public.shops where owner_id = '${C1.id}') + (select count(*) from public.settings where owner_id = '${C1.id}') + (select count(*) from public.subscriptions where owner_id = '${C1.id}')`) === '0')
const asCustomer = await A.c.rpc('register_customer', { p_name: 'Owner A', p_phone: A.digits })
const ownerOrders = asCustomer.error ? { error: asCustomer.error } : await A.c.rpc('place_order', { p: order(B) })
check('roles', 'a shop owner can also register as a customer and order from another shop', !asCustomer.error && !ownerOrders.error, asCustomer.error?.message ?? ownerOrders.error?.message)
check('roles', 'and is still treated as an owner afterwards', (await A.c.rpc('my_context')).data?.is_owner === true && (await count(A, 'orders')) >= 2)

// -- double submit from two tabs
const key = randomUUID()
const burst = await Promise.all(Array.from({ length: 6 }, () => C2.c.rpc('place_order', { p: order(A, key) })))
const ids = new Set(burst.map((r) => r.data?.order_id).filter(Boolean))
check('idempotency', 'six parallel submits with the same key create exactly one order', ids.size === 1 && psql(`select count(*) from public.orders where idempotency_key = '${key}'`) === '1', `${ids.size} ids, errors: ${burst.filter((r) => r.error).map((r) => r.error.message).join('; ')}`)

// -- what an error tells a customer
const messages = []
const probe = async (p) => { const r = await C1.c.rpc('place_order', { p }); if (r.error) messages.push(r.error.message) }
await probe(order(A, randomUUID(), { price: 1 }))
await probe({ ...order(A), items: [{ variant_id: B.variant, qty: 1 }] })
await probe({ ...order(A), items: [{ variant_id: A.variant, qty: 99 }] })
await probe({ ...order(A), requested_for: '2020-01-01' })
await probe({ ...order(A), slug: 'no-such-shop-xyz' })
await probe({ ...order(A), payment_method: 'upi' })
psql(`update public.shops set accepts_orders = false where owner_id = '${A.id}'`)
await probe(order(A))
psql(`update public.shops set accepts_orders = true where owner_id = '${A.id}'`)
psql(`update public.subscriptions set ends_at = now() - interval '200 days' where owner_id = '${B.id}'`)
await probe(order(B))
for (const r of [await C1.c.rpc('claim_payment', { p_order_id: o1, p_utr: '1' }), await C1.c.rpc('customer_order_get', { p_order_id: o2 })]) if (r.error) messages.push(r.error.message)
const leaky = messages.filter((m) => /plan|owner|trial|subscription|constraint|violates|policy|relation|sql|SB4\d\d|auth\.|app_private/i.test(m))
check('errors', `the ${messages.length} error messages a customer can trigger mention no plan, owner, SQL or internals`, leaky.length === 0, leaky.join(' | '))
const raw = await C1.c.from('orders').insert({ owner_id: A.id, order_no: 998, customer_name: 'x' })
console.log(`  info  a direct table abuse returns PostgREST's own message (not shown by the app): "${raw.error?.message}"`)

// ======================================================================================================================
console.log('\n3. Pictures (public bucket)')
// ======================================================================================================================
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const up = (u, path, body = png, type = 'image/png') => u.c.storage.from('catalog').upload(path, body, { contentType: type })
const mine = `${A.id}/p/audit-${rnd(4)}.png`
check('pictures', 'a shop uploads a picture into its own folder', !(await up(A, mine)).error)
const pubUrl = anon.storage.from('catalog').getPublicUrl(mine).data.publicUrl
check('pictures', 'anyone can fetch it by its address, with no login', (await fetch(pubUrl)).status === 200)
const listed = await anon.storage.from('catalog').list(A.id)
check('pictures', 'a visitor cannot list the bucket', listed.error !== null || (listed.data?.length ?? 0) === 0, `${listed.data?.length} entries`)
check('pictures', 'a customer cannot upload (not into their own folder, not into a shop\'s)', (await up(C1, `${C1.id}/x.png`)).error !== null && (await up(C1, `${A.id}/p/evil.png`)).error !== null)
check('pictures', "a shop cannot write into another shop's folder", (await up(B, `${A.id}/p/evil.png`)).error !== null)
check('pictures', 'a shop cannot delete another shop\'s picture', ((await B.c.storage.from('catalog').remove([mine])).data ?? []).length === 0 && (await fetch(pubUrl)).status === 200)
check('pictures', 'a picture over 1 MB is refused', (await up(A, `${A.id}/p/big-${rnd(4)}.png`, Buffer.alloc(1_200_000, 1))).error !== null)
check('pictures', 'a file that is not a picture is refused', (await up(A, `${A.id}/p/note-${rnd(4)}.txt`, Buffer.from('hello'), 'text/plain')).error !== null)

// ======================================================================================================================
console.log('\n4. Secrets in the code and the built app')
// ======================================================================================================================
const jwtRole = (t) => { try { return JSON.parse(Buffer.from(t.split('.')[1] ?? '', 'base64url').toString()).role } catch { return null } }
const assets = join('dist', 'assets')
if (existsSync(assets)) {
  const text = readdirSync(assets).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n')
  const jwts = text.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? []
  check('secrets', 'the built app contains no service-role key or secret key', !/sb_secret_[A-Za-z0-9_-]{20,}/.test(text) && jwts.every((t) => jwtRole(t) !== 'service' + '_role'), `${jwts.length} JWT-shaped strings, roles: ${[...new Set(jwts.map(jwtRole))].join(',')}`)
} else console.log('  info  no dist/ folder: run npm run build to check the built app too')

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`)
process.exitCode = failed.length === 0 ? 0 : 1
