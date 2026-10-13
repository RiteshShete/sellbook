import { test } from '@playwright/test'
import { mockApi, ORDERS, signIn } from './mock'
test('receipt animation frames', async ({ page }) => {
  await signIn(page)
  await mockApi(page)
  await page.goto(`/sellbook/orders/${ORDERS[0]?.id}`)
  await page.getByText(/^Bill INV/).waitFor()
  await page.getByText(/^Bill INV/).scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, 40))
  await page.reload()
  await page.getByText(/^Bill INV/).scrollIntoViewIfNeeded()
  for (const [name, ms] of [['mid', 450], ['end', 1900]] as const) {
    await page.waitForTimeout(ms)
    await page.screenshot({ path: `docs/ui-audit/after/14-bill-receipt-${name}.png`, fullPage: true })
  }
})
