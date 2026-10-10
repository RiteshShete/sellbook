import type { Page, Route } from '@playwright/test'

/**
 * A fake Supabase for screenshots and accessibility runs. EVERY request to the API origin is
 * answered here, so nothing reaches a real project and no real order, product or bill is read or
 * written. All names below are test data (Devanagari + English).
 */
export const API = 'http://localhost:54321'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const OWNER = id(1)
const TODAY = new Date().toISOString().slice(0, 10)
const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

export interface MockOptions {
  /** Test categories; the real app starts with none. */
  categories?: { id: string; name: string; sort_order: number }[]
}

export const TEST_CATEGORIES = [
  { id: id(901), name: 'पीठे (Flours)', sort_order: 0 },
  { id: id(902), name: 'भाजणी व मिक्स (Mixes)', sort_order: 1 },
]

const variant = (
  n: number,
  product: number,
  name: string,
  price: number,
  size: [number, 'g' | 'ml' | 'pcs'] | null,
  sort: number,
) => ({
  id: id(n),
  product_id: id(product),
  name,
  price,
  cost_price: null,
  size_amount: size ? size[0] : null,
  size_unit: size ? size[1] : null,
  sort_order: sort,
  is_active: true,
  deleted_at: null,
})

const products = (cats: boolean) => [
  {
    id: id(101),
    name: 'Modak Pith',
    sort_order: 0,
    is_active: true,
    category_id: cats ? TEST_CATEGORIES[0]?.id : null,
    variants: [variant(201, 101, '500 g', 60, [500, 'g'], 0)],
  },
  {
    id: id(102),
    name: 'उपवास भाजणी',
    sort_order: 0,
    is_active: true,
    category_id: cats ? TEST_CATEGORIES[1]?.id : null,
    variants: [
      variant(202, 102, 'Retail', 150, [500, 'g'], 0),
      variant(203, 102, 'Wholesale', 1350, [5000, 'g'], 1),
    ],
  },
  {
    id: id(103),
    name: 'कण्हेरी',
    sort_order: 0,
    is_active: true,
    category_id: cats ? TEST_CATEGORIES[1]?.id : null,
    variants: [variant(204, 103, 'Retail', 90, [250, 'g'], 0)],
  },
  {
    id: id(104),
    name: 'राजगिरा पीठ',
    sort_order: 0,
    is_active: true,
    category_id: cats ? TEST_CATEGORIES[0]?.id : null,
    variants: [variant(205, 104, 'Retail', 130, [500, 'g'], 0)],
  },
  {
    id: id(105),
    name: 'वडे पीठ',
    sort_order: 0,
    is_active: true,
    category_id: null,
    variants: [
      variant(206, 105, 'Retail', 110, [500, 'g'], 0),
      variant(207, 105, 'Retail', 200, [1000, 'g'], 1),
    ],
  },
]

const item = (n: number, order: number, product: string, v: string, price: number, qty: number, size: [number, 'g'] | null, pos: number) => ({
  id: id(n),
  order_id: id(order),
  variant_id: null,
  product_name: product,
  variant_name: v,
  unit_price: price,
  quantity: qty,
  line_total: price * qty,
  position: pos,
  size_amount: size ? size[0] : null,
  size_unit: size ? size[1] : null,
})

const order = (
  n: number,
  no: number,
  status: 'new' | 'ready' | 'delivered',
  name: string,
  phone: string | null,
  due: string | null,
  items: ReturnType<typeof item>[],
  paid = false,
) => ({
  id: id(n),
  order_no: no,
  customer_name: name,
  customer_phone: phone,
  order_date: TODAY,
  due_date: due,
  notes: null,
  status,
  payment_status: paid ? 'paid' : 'pending',
  payment_mode: paid ? 'online' : null,
  discount: 0,
  total: items.reduce((s, i) => s + i.line_total, 0),
  bill_no: null,
  bill_prefix: null,
  version_no: 1,
  created_at: new Date().toISOString(),
  ready_at: status === 'ready' ? new Date().toISOString() : null,
  delivered_at: status === 'delivered' ? new Date().toISOString() : null,
  paid_at: paid ? new Date().toISOString() : null,
  cancelled_at: null,
  cancelled_from: null,
  order_items: items,
})

export const LONG_NAME = 'सौ. सुनंदा श्रीकांत कुलकर्णी आणि कुटुंब, पुणे'

export const ORDERS = [
  order(301, 15, 'ready', LONG_NAME, '919876543210', day(1), [
    item(401, 301, 'उपवास भाजणी', 'Retail', 150, 2, [500, 'g'], 0),
    item(402, 301, 'Modak Pith', '500 g', 60, 5, [500, 'g'], 1),
    item(403, 301, 'वडे पीठ', 'Retail', 200, 1, [1000, 'g'], 2),
  ]),
  order(302, 14, 'new', 'Asha Patil', '919123456780', TODAY, [
    item(404, 302, 'कण्हेरी', 'Retail', 90, 4, [250, 'g'], 0),
  ]),
  order(303, 13, 'new', 'राहुल देशपांडे', null, day(-1), [
    item(405, 303, 'राजगिरा पीठ', 'Retail', 130, 3, [500, 'g'], 0),
    item(406, 303, 'Modak Pith', '500 g', 60, 2, [500, 'g'], 1),
  ]),
  order(304, 12, 'ready', 'Meera Joshi', '919000011122', day(2), [
    item(407, 304, 'उपवास भाजणी', 'Wholesale', 1350, 1, [5000, 'g'], 0),
  ], true),
]

const SETTINGS = {
  id: id(2),
  owner_id: OWNER,
  shop_name: 'Test Shop',
  shop_address: 'Pune',
  shop_phone: '9876543210',
  upi_id: null,
  qr_path: null,
  logo_path: null,
  bill_prefix: 'INV',
  next_bill_no: 1,
  bill_footer: null,
}

const PENDING = [
  { id: id(310), order_no: 9, bill_no: null, customer_name: 'Test Customer A', customer_phone: null, total: 300, delivered_at: new Date().toISOString(), age_days: 3, bucket: '0-7' },
  { id: id(311), order_no: 8, bill_no: null, customer_name: 'Test Customer B', customer_phone: null, total: 300, delivered_at: new Date().toISOString(), age_days: 12, bucket: '8-30' },
]

const ANALYTICS = {
  month: TODAY.slice(0, 7),
  sales: 4200,
  orders: 6,
  units: 21,
  aov: 700,
  collected: 3600,
  collected_online: 2400,
  collected_cash: 1200,
  outstanding_total: 600,
  outstanding_count: 2,
  by_product: [],
  by_variant: [],
  daily: [],
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
}

function jwt(): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: OWNER, role: 'authenticated', exp: 4_102_444_800 })}.sig`
}

const USER = {
  id: OWNER,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'owner@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
}

/** Puts a fake signed-in session in storage before the app starts. */
export async function signIn(page: Page): Promise<void> {
  const session = {
    access_token: jwt(),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 4_102_444_800,
    refresh_token: 'test-refresh',
    user: USER,
  }
  await page.addInitScript((s) => {
    localStorage.setItem('sb-localhost-auth-token', JSON.stringify(s))
  }, session)
}

export async function mockApi(page: Page, opts: MockOptions = {}): Promise<void> {
  const cats = opts.categories ?? []
  await page.route(`${API}/**`, async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const path = url.pathname
    if (path.startsWith('/auth/v1/user')) return json(USER)
    if (path.startsWith('/auth/v1/token')) {
      return json({ access_token: jwt(), token_type: 'bearer', expires_in: 3600, expires_at: 4_102_444_800, refresh_token: 'test-refresh', user: USER })
    }
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.split('/').pop()
      if (fn === 'init_settings') return json(SETTINGS)
      if (fn === 'pending_payments') return json(PENDING)
      if (fn === 'analytics_month') return json(ANALYTICS)
      if (fn === 'bill_content_hash') return json('hash')
      if (fn === 'prep_list') {
        return json({
          orders: 2,
          products: [
            { key: 'a', name: 'कण्हेरी', quantity: 4, orders: 1, grams: 1000, ml: 0, pieces: 0, unsized: 0, variants: [{ key: 'a1', name: 'Retail', quantity: 4, orders: 1, grams: 1000, ml: 0, pieces: 0, unsized: 0 }] },
            { key: 'b', name: 'राजगिरा पीठ', quantity: 3, orders: 1, grams: 1500, ml: 0, pieces: 0, unsized: 0, variants: [{ key: 'b1', name: 'Retail', quantity: 3, orders: 1, grams: 1500, ml: 0, pieces: 0, unsized: 0 }] },
          ],
        })
      }
      return json([])
    }
    if (path === '/rest/v1/products') return json(products(cats.length > 0))
    if (path === '/rest/v1/categories') {
      return url.search.includes('deleted_at=not.is.null') ? json([]) : json(cats)
    }
    if (path === '/rest/v1/settings') return json([SETTINGS])
    if (path === '/rest/v1/orders') {
      const status = url.searchParams.get('status')?.replace('eq.', '')
      const oid = url.searchParams.get('id')?.replace('eq.', '')
      let rows = ORDERS
      if (status) rows = rows.filter((o) => o.status === status)
      if (oid) rows = rows.filter((o) => o.id === oid)
      const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      return wantsObject ? json(rows[0] ?? null) : json(rows)
    }
    if (req.method() === 'GET') return json([])
    return json({})
  })
}
