import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { newShopOwner, sql } from './helpers'

/**
 * C13: an axe scan (WCAG 2.2 AA) and a "no sideways scroll at 360 px" check of the OWNER and sign-in screens, on the local
 * stack with a real shop that has a product and an order. Serious or critical findings fail the run.
 */
const stamp = Date.now().toString(36)

async function scan(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(bad.map((v) => `${path}: ${v.id} (${v.nodes.length}): ${v.help}`), `${path} accessibility`).toEqual([])
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, `${path} scrolls sideways by ${overflow}px at 360px`).toBeLessThanOrEqual(0)
}

test('sign-in screens', async ({ page }) => {
  for (const path of ['/login', '/signup', '/forgot', '/terms', '/privacy']) await scan(page, path)
})

test('owner screens', async ({ page }) => {
  test.setTimeout(240_000)
  const { ownerId } = await newShopOwner(page, stamp)
  sql(`insert into public.products (owner_id, name) values ('${ownerId}', 'Chakli')`)
  sql(`insert into public.variants (owner_id, product_id, name, price) select owner_id, id, 'Std', 150 from public.products where owner_id = '${ownerId}'`)
  sql(`insert into public.orders (owner_id, order_no, customer_name, customer_phone) values ('${ownerId}', 1, 'Asha Patil', '919876543210')`)
  const paths = ['/', '/delivery', '/analytics', '/pending', '/catalog', '/catalog/new', '/catalog/categories', '/catalog/configure', '/orders', '/orders/new',
    '/activity', '/more', '/settings', '/more/shop', '/more/shop/poster', '/pricing', '/plan', '/trash', '/account']
  for (const path of paths) await scan(page, path)
  // an order page (the first one in the list)
  const id = sql(`select id from public.orders where owner_id = '${ownerId}' limit 1`)
  await scan(page, `/orders/${id}`)
  await scan(page, `/orders/${id}/history`)
})
