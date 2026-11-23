import { expect, test } from '@playwright/test'
import { addRecoveryEmail, newShopOwner, samplePng, sql } from './helpers'

/**
 * STOREFRONT_PLAN S3 "definition of done", phone-sized, on the local stack: build a small shop (products with a
 * picture, an offer ending tomorrow, free delivery above Rs 500), see what is missing, fix it, publish, copy the link.
 */
const stamp = Date.now().toString(36)
const email = `shop-${stamp}@example.test`

test('owner builds and publishes a shop', async ({ page }) => {
  test.setTimeout(180_000) // a long flow: sign-up, products, picture, offer, emailed code, publish
  // print what failed, so a red run explains itself
  page.on('response', (r) => {
    if (r.status() >= 400) console.log('HTTP', r.status(), r.request().method(), r.url().replace(/\?.*/, ''))
  })
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('console error:', m.text())
  })
  const { slug, ownerId } = await newShopOwner(page, stamp)

  // two products with one variant each (the existing product form)
  for (const [name, price] of [['Chakli', '150'], ['Ladoo', '100']] as const) {
    await page.goto('/catalog/new')
    await page.getByLabel('Product name').fill(name)
    await page.getByLabel('Selling price (₹)').fill(price)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).toHaveURL(/\/catalog$/)
  }

  // online details and a picture for Chakli (picture resized in the browser, two sizes uploaded)
  await page.goto('/catalog')
  await page.getByText('Chakli').first().click()
  await expect(page.getByText('In your online shop')).toBeVisible()
  await page.getByLabel('Description').fill('Crunchy, made fresh')
  await page.getByLabel('Veg mark').selectOption('veg')
  await page.getByRole('button', { name: 'Save online details' }).click()
  await expect(page.getByText('Online details saved').first()).toBeVisible()
  await page.getByTestId('photo-input').setInputFiles({ name: 'chakli.png', mimeType: 'image/png', buffer: samplePng() })
  await expect(page.getByText('Picture added').first()).toBeVisible()
  const img = page.getByRole('img', { name: /Picture 1/ })
  await expect(img).toBeVisible()
  const files = sql(`select count(*) from storage.objects where bucket_id = 'catalog' and name like '${ownerId}/p/%'`)
  expect(files).toBe('2') // the full size and its thumbnail
  const src = await img.getAttribute('src')
  expect((await page.request.get(src ?? '')).status()).toBe(200) // public, no login

  // delivery rules + an offer ending tomorrow
  await page.goto('/pricing')
  await page.getByLabel('Delivery charge (₹)').fill('40')
  await page.getByLabel('Free delivery from (₹, optional)').fill('500')
  await page.getByLabel('Minimum order (₹)').fill('200')
  await page.getByLabel('Time needed before an order (hours)').fill('0')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved').first()).toBeVisible()

  await page.getByRole('button', { name: 'Offer' }).first().click() // Chakli (first product)
  await page.getByLabel('Offer price (₹)').fill('120')
  await page.getByLabel('Offer name (optional, e.g. Diwali offer)').fill('Diwali offer')
  await page.getByRole('button', { name: 'Save offer' }).click()
  await expect(page.getByText('Offer on')).toBeVisible()
  await expect(page.getByText(/Ends tomorrow/)).toBeVisible()

  // the calculator agrees: 2 x Chakli at 120 = 240 + 40 delivery = 280
  await page.getByRole('button', { name: /One more Chakli/ }).click()
  await page.getByRole('button', { name: /One more Chakli/ }).click()
  await expect(page.getByText('Customer pays').locator('xpath=following-sibling::dd[1]')).toHaveText('₹280')

  // publishing is refused and says exactly what is missing
  await page.goto('/more/shop')
  await page.getByText('Hidden: only you can see it').click() // the visible label, as a finger would
  await expect(page.getByText('Add your WhatsApp number below.')).toBeVisible()
  await expect(page.getByText('Confirm a recovery email in Account & security.')).toBeVisible()

  await page.getByLabel('WhatsApp number customers can message').fill('9876543210')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved').first()).toBeVisible()
  await page.goto('/account')
  await addRecoveryEmail(page, email)

  await page.goto('/more/shop')
  await page.getByText('Hidden: only you can see it').click() // the visible label, as a finger would
  await expect(page.getByText('Your shop is live').first()).toBeVisible()
  await expect(page.getByText(/It can no longer be changed/)).toBeVisible()
  await expect(page.getByTestId('shop-link')).toHaveText(new RegExp(`/${slug}/products$`))

  // what the public sees (anon key only): the picture, the offer and the shop rules
  const anon = process.env.E2E_ANON_KEY ?? ''
  const url = process.env.E2E_SUPABASE_URL ?? ''
  const rpc = async (fn: string) =>
    (await (await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
    })).json()) as Record<string, unknown>
  const shop = await rpc('storefront_shop')
  expect([shop.delivery_fee, shop.free_delivery_above, shop.min_order]).toEqual([40, 500, 200])
  const catalog = (await rpc('storefront_catalog')) as { products: { name: string; image_paths: string[]; variants: { effective_price: number; offer_label: string | null }[] }[] }
  const chakli = catalog.products.find((p) => p.name === 'Chakli')
  expect(chakli?.image_paths.length).toBe(1)
  expect(chakli?.variants[0]).toMatchObject({ effective_price: 120, offer_label: 'Diwali offer' })
  expect(catalog.products.find((p) => p.name === 'Ladoo')?.variants[0]?.effective_price).toBe(100)
})
