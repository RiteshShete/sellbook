import { randomUUID } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { newShopOwner, sql } from './helpers'

/**
 * STOREFRONT_PLAN S4 "definition of done", phone-sized, on the local stack: as a brand-new visitor open the shop, browse,
 * add items, register, check out with delivery, see the order page; the owner sees the order on their board.
 */
const stamp = Date.now().toString(36)
// fresh ids every run, so the spec can run again on the same local database
const [P_CHAKLI, P_LADOO, V_SMALL, V_LARGE, V_BOX] = Array.from({ length: 5 }, () => randomUUID())
const customer = { name: 'Asha Patil', phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`, password: 'Cust-pass-1' }

async function accessible(page: Page, what: string) {
  // Rows fade in for ~0.5 s; on a slow CI runner axe could measure a half-faded colour. "Reduce motion" (honoured by
  // src/index.css) ends the animations at once, so the colours measured are the final ones.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  // The element and axe's message are in the text, so a failure on a CI runner can be read without a screenshot.
  const lines = bad.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} | ${n.any[0]?.message ?? v.help}`).join('; ')}`)
  expect(lines, `accessibility on ${what}`).toEqual([])
}

test('a new visitor browses, orders, and the owner sees it', async ({ page, browser, baseURL }) => {
  test.setTimeout(240_000)
  page.on('response', (r) => {
    if (r.status() >= 400) console.log('HTTP', r.status(), r.request().method(), r.url().replace(/\?.*/, ''))
  })

  // ---- the owner's shop, set up with SQL (the screens for this are covered by shop-setup.spec.ts)
  const ownerCtx = await browser.newContext({ baseURL, viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true })
  const ownerPage = await ownerCtx.newPage()
  const { slug, ownerId } = await newShopOwner(ownerPage, stamp)
  sql(`update public.shops set is_published = true, whatsapp = '919876543210', delivery_fee = 40, free_delivery_above = 500,
       min_order = 0, lead_time_hours = 0, delivery_note = 'Within 5 km', banner_text = 'Diwali sale' where owner_id = '${ownerId}'`)
  sql(`insert into public.products (id, owner_id, name, description, ingredients, allergens, veg_type) values
       ('${P_CHAKLI}', '${ownerId}', 'Chakli', 'Crunchy, made fresh', 'Rice flour, spices', array['sesame'], 'veg'),
       ('${P_LADOO}', '${ownerId}', 'Ladoo', null, null, '{}', 'veg')`)
  sql(`insert into public.variants (id, owner_id, product_id, name, price, sort_order) values
       ('${V_SMALL}', '${ownerId}', '${P_CHAKLI}', 'Small', 100, 0), ('${V_LARGE}', '${ownerId}', '${P_CHAKLI}', 'Large', 150, 1),
       ('${V_BOX}', '${ownerId}', '${P_LADOO}', 'Box', 80, 0)`)
  sql(`update public.variants set offer_price = 120, offer_label = 'Diwali offer', offer_starts_at = now() - interval '1 hour',
       offer_ends_at = now() + interval '2 days' where id = '${V_LARGE}'`)

  // ---- browse (signed out)
  await page.goto(`/${slug}/products`)
  await expect(page.getByRole('heading', { name: `Shop ${stamp}`, level: 1 })).toBeVisible()
  await expect(page.getByText('Diwali sale')).toBeVisible()
  await expect(page.getByText('Taking orders')).toBeVisible()
  await expect(page.getByText(/from ₹100/)).toBeVisible()
  await accessible(page, 'the catalogue')
  await page.getByPlaceholder('Search products').fill('lad')
  await expect(page.getByRole('heading', { name: 'Chakli' })).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Ladoo' })).toBeVisible()
  await page.getByPlaceholder('Search products').fill('')

  // ---- a product: choose Large (on offer), two of them, add
  await page.getByRole('link', { name: /Chakli/ }).click()
  await expect(page.getByRole('heading', { name: 'Chakli', level: 1 })).toBeVisible()
  await expect(page.getByText('Rice flour, spices')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose an option' })).toBeDisabled()
  await page.getByRole('radio', { name: /Large/ }).check()
  await page.getByRole('button', { name: 'One more' }).click()
  await accessible(page, 'a product page')
  await page.getByRole('button', { name: 'Add to cart' }).click()
  await expect(page.getByRole('link', { name: /View cart · 2 items/ })).toContainText('₹280') // 2 x 120 + 40 delivery

  // ---- the price drops after it was added: the cart says so
  sql(`update public.variants set offer_price = 110 where id = '${V_LARGE}'`)
  await page.goto(`/${slug}/cart`)
  await expect(page.getByText('Price updated')).toBeVisible()
  await expect(page.getByText('Estimated total').locator('xpath=following-sibling::dd[1]')).toHaveText('₹260') // 2 x 110 + 40
  await accessible(page, 'the cart')

  // ---- checkout asks for sign-in, sign-up brings the customer straight back
  await page.getByRole('button', { name: 'Continue to checkout' }).click()
  await expect(page).toHaveURL(new RegExp(`/${slug}/login$`))
  await page.getByRole('link', { name: 'New here? Create an account' }).click()
  await page.getByLabel('Your name', { exact: true }).fill(customer.name)
  await page.getByLabel('Mobile number', { exact: true }).fill(customer.phone)
  await page.getByLabel('Password (at least 8 characters)').fill(customer.password)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(new RegExp(`/${slug}/checkout$`))

  // ---- checkout: delivery to a new address, pay on delivery, place the order (double tap = one order)
  await expect(page.getByLabel('Name for delivery')).toHaveValue(customer.name)
  await page.getByLabel('House, street').fill('12 Market Road')
  await page.getByLabel('City').fill('Pune')
  await page.getByLabel('Pincode').fill('411001')
  await accessible(page, 'checkout')
  await page.getByRole('button', { name: 'Place order' }).dblclick()
  await expect(page).toHaveURL(new RegExp(`/${slug}/orders/[0-9a-f-]{36}$`))
  expect(sql(`select count(*) from public.orders where owner_id = '${ownerId}' and source = 'customer'`)).toBe('1')
  expect(sql(`select total::text || '/' || fulfilment || '/' || confirmation_status from public.orders where owner_id = '${ownerId}'`)).toBe('260.00/delivery/pending')

  // ---- the order page
  await expect(page.getByRole('heading', { name: /Order #1/ })).toBeVisible()
  await expect(page.getByText(/2 × Chakli/)).toBeVisible()
  await expect(page.getByText('Total').locator('xpath=following-sibling::dd[1]')).toHaveText('₹260')
  await expect(page.getByRole('list', { name: 'Order progress' })).toBeVisible()
  await accessible(page, 'the order page')

  // ---- the owner sees it on the board, another device, no refresh needed beyond opening Home
  await ownerPage.goto('/')
  await expect(ownerPage.getByText(customer.name).first()).toBeVisible()

  // ---- the customer can cancel while the shop has not confirmed it
  await page.getByRole('button', { name: 'Cancel this order' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel this order' }).click()
  await expect(page.getByText('This order was cancelled')).toBeVisible()
  expect(sql(`select status::text from public.orders where owner_id = '${ownerId}'`)).toBe('cancelled')

  // ---- an unknown shop reveals nothing
  await page.goto('/no-such-shop-xyz/products')
  await expect(page.getByRole('heading', { name: 'Shop not found' })).toBeVisible()
})
