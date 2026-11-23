import AxeBuilder from '@axe-core/playwright'
import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { newShopOwner, sql } from './helpers'

/**
 * STOREFRONT_PLAN S5 "definition of done", phone-sized, on the local stack, with TWO devices (two browser contexts):
 * a customer pays by UPI and tells the shop; the owner sees it live, confirms, checks the payment, says "not received",
 * accepts the retry; a second order switches to pay on delivery; a third is declined after a claim (refund reminder).
 */
const stamp = Date.now().toString(36)
const [P_CHAKLI, V_BOX] = [randomUUID(), randomUUID()]
const customer = { name: 'Asha Patil', phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`, password: 'Cust-pass-1' }

async function accessible(page: Page, selector: string, what: string) {
  const result = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(bad.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`), `accessibility of ${what}`).toEqual([])
}

/** Puts one Chakli in the cart without clicking through the shop again, then opens checkout. */
async function startCheckout(page: Page, slug: string) {
  await page.goto(`/${slug}/products`)
  await page.evaluate(
    ([key, id]) => localStorage.setItem(key as string, JSON.stringify({ v: 1, lines: [{ variantId: id, qty: 1, seen: 25000 }] })),
    [`sb:cart:${slug}`, V_BOX],
  )
  await page.goto(`/${slug}/checkout`)
}

async function placeUpiOrder(page: Page, slug: string) {
  await startCheckout(page, slug)
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()
  await page.getByRole('radio', { name: 'Pay by UPI' }).check()
  await page.getByLabel('House, street').fill('12 Market Road')
  await page.getByLabel('City').fill('Pune')
  await page.getByLabel('Pincode').fill('411001')
  await page.getByRole('button', { name: 'Place order' }).click()
  await expect(page).toHaveURL(new RegExp(`/${slug}/orders/[0-9a-f-]{36}$`))
}

async function claim(page: Page, utr: string) {
  await page.getByRole('button', { name: /I have paid/ }).click()
  await page.getByLabel(/UTR or reference number/).fill(utr)
  await page.getByRole('button', { name: 'Tell the shop' }).click()
  await expect(page.getByText('Waiting for the shop to confirm your payment')).toBeVisible()
}

test('a customer pays by UPI, the owner confirms and verifies, with every other path', async ({ page, browser, baseURL }) => {
  test.setTimeout(300_000)
  page.on('response', (r) => {
    if (r.status() >= 400) console.log('HTTP', r.status(), r.request().method(), r.url().replace(/\?.*/, ''))
  })

  // ---- the owner's shop (SQL for the parts the other specs already cover through the screens)
  const ownerCtx = await browser.newContext({ baseURL, viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true })
  const owner = await ownerCtx.newPage()
  const { slug, ownerId } = await newShopOwner(owner, stamp)
  sql(`update public.shops set is_published = true, whatsapp = '919876543210', delivery_fee = 40, free_delivery_above = 500, min_order = 0, lead_time_hours = 0 where owner_id = '${ownerId}'`)
  sql(`update public.settings set upi_id = 'ritesh@upi', payee_name = 'Ritesh Foods' where owner_id = '${ownerId}'`)
  sql(`insert into public.products (id, owner_id, name) values ('${P_CHAKLI}', '${ownerId}', 'Chakli')`)
  sql(`insert into public.variants (id, owner_id, product_id, name, price) values ('${V_BOX}', '${ownerId}', '${P_CHAKLI}', 'Box', 250)`)

  // ---- the customer registers and places order 1 (UPI); the owner's Home is already open and gets it LIVE
  await owner.goto('/')
  await expect(owner.getByText('No new orders')).toBeVisible()
  await page.goto(`/${slug}/signup`)
  await page.getByLabel('Your name', { exact: true }).fill(customer.name)
  await page.getByLabel('Mobile number', { exact: true }).fill(customer.phone)
  await page.getByLabel('Password (at least 8 characters)').fill(customer.password)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(new RegExp(`/${slug}/products$`))
  await placeUpiOrder(page, slug)
  const order1 = page.url()

  await expect(owner.getByText(`New order #1 from ${customer.name}`)).toBeVisible({ timeout: 15_000 }) // realtime, no reload
  await expect(owner.getByRole('heading', { name: 'Needs your action (1)' })).toBeVisible()
  await expect.poll(() => owner.title()).toMatch(/^\(1\) /) // the count is in the page title
  await expect(owner.getByText('Waiting for you to confirm')).toBeVisible()
  await accessible(owner, '[aria-label="Needs your action"]', 'the needs-action list')

  // ---- the owner confirms; one tap opens WhatsApp to the customer with the sentence ready
  await owner.getByTestId('needs-action-card').getByRole('button', { name: 'Confirm order' }).click()
  await owner.getByRole('dialog').getByRole('button', { name: 'Confirm order' }).click()
  const tell = owner.getByRole('dialog').getByRole('link', { name: 'Tell the customer on WhatsApp' })
  await expect(tell).toBeVisible()
  const href = (await tell.getAttribute('href')) ?? ''
  expect(href).toContain(`https://wa.me/91${customer.phone}`)
  expect(decodeURIComponent(href)).toContain('order #1')
  expect(decodeURIComponent(href)).toContain('is confirmed')
  await owner.getByRole('dialog').getByRole('button', { name: 'Skip' }).click()
  await expect(owner.getByRole('heading', { name: /Needs your action/ })).toBeHidden()
  expect(sql(`select confirmation_status from public.orders where owner_id = '${ownerId}' and order_no = 1`)).toBe('confirmed')

  // ---- the customer sees it, pays (exact amount), tells the shop
  await page.reload()
  await expect(page.getByText('Ready', { exact: true })).toBeVisible()
  await expect(page.getByText('₹290').first()).toBeVisible() // 250 + 40 delivery
  const upiHref = (await page.getByRole('link', { name: /Pay with a UPI app/ }).getAttribute('href')) ?? ''
  expect(upiHref).toContain('am=290.00')
  expect(upiHref).not.toMatch(/[?&](tr|mc)=/)
  await accessible(page, '[aria-label="Payment"]', 'the payment panel')
  await claim(page, '123456789012')

  // ---- the owner is alerted live, checks the amount and says "not received"
  await expect(owner.getByText('Payment claimed on order #1: check your bank')).toBeVisible({ timeout: 15_000 })
  await expect(owner.getByTestId('claimed-amount')).toHaveText('₹290')
  await expect(owner.getByText('UTR 123456789012')).toBeVisible()
  await owner.getByRole('button', { name: 'Not received' }).click()
  await owner.getByLabel(/Reason \(the customer will see this\)/).fill('Not in my account')
  await owner.getByRole('button', { name: 'Tell the customer it was not received' }).click()
  await expect(owner.getByTestId('claimed-amount')).toBeHidden()

  // ---- the customer sees why, and tries again
  await page.reload()
  await expect(page.getByText(/Not in my account/)).toBeVisible()
  await claim(page, '210987654321')

  // ---- the owner verifies: only a tap marks it paid
  await expect(owner.getByTestId('claimed-amount')).toHaveText('₹290', { timeout: 15_000 })
  await owner.getByRole('button', { name: 'Verified, mark paid' }).click()
  await owner.getByRole('dialog').getByRole('button', { name: 'Yes, I received it' }).click()
  await owner.getByRole('dialog').getByRole('button', { name: 'Skip' }).click()
  expect(sql(`select payment_status::text || '/' || payment_mode::text || '/' || payment_claim_status || '/' || payment_reference from public.orders where owner_id = '${ownerId}' and order_no = 1`)).toBe('paid/online/verified/210987654321')
  await page.reload()
  await expect(page.getByText('Payment confirmed')).toBeVisible()

  // ---- the owner moves it on: ready (allowed now it is confirmed)
  await owner.goto(`/orders/${order1.split('/').pop()}`)
  await owner.getByRole('button', { name: /Mark ready|Ready/ }).first().click()
  await page.reload()
  await expect(page.getByRole('list', { name: 'Order progress' })).toBeVisible()
  expect(sql(`select status::text from public.orders where owner_id = '${ownerId}' and order_no = 1`)).toBe('ready')

  // ---- the order's history lists every step, including the customer-order ones (it used to fail on unknown reasons)
  await owner.goto(`/orders/${order1.split('/').pop()}/history`)
  for (const label of ['Confirmed', 'Payment claimed', 'Payment not received', 'Payment verified']) {
    await expect(owner.getByText(label, { exact: true }).first()).toBeVisible()
  }

  // ---- order 2: claim, "not received", then pay on delivery instead
  await placeUpiOrder(page, slug)
  await claim(page, '')
  await owner.goto('/')
  await owner.getByRole('button', { name: 'Not received' }).click()
  await owner.getByLabel(/Reason \(the customer will see this\)/).fill('Wrong amount')
  await owner.getByRole('button', { name: 'Tell the customer it was not received' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Pay on delivery instead' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Pay on delivery instead' }).click()
  await expect(page.getByText('Pay ₹290 when you receive your order.')).toBeVisible()
  expect(sql(`select payment_method || '/' || payment_claim_status from public.orders where owner_id = '${ownerId}' and order_no = 2`)).toBe('cod/none')

  // ---- order 3: the customer claims, the owner declines: a refund reminder stays on the board
  await placeUpiOrder(page, slug)
  await claim(page, '111122223333')
  await owner.goto('/')
  const card3 = owner.getByTestId('needs-action-card').filter({ hasText: '#3' })
  await expect(card3).toBeVisible()
  await card3.getByRole('button', { name: 'Decline' }).click()
  await owner.getByRole('dialog').getByRole('button', { name: 'Decline order' }).click()
  await expect(owner.getByRole('dialog').getByText(/refund the customer by hand/)).toBeVisible()
  await owner.getByRole('dialog').getByRole('button', { name: 'Skip' }).click()
  await expect(owner.getByRole('alert').filter({ hasText: 'declined after' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('The shop could not take this order')).toBeVisible()
  expect(sql(`select status::text || '/' || confirmation_status from public.orders where owner_id = '${ownerId}' and order_no = 3`)).toBe('cancelled/declined')
})
