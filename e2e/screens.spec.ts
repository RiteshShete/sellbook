import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { LONG_NAME, mockApi, ORDERS, signIn, TEST_CATEGORIES } from './mock'

const label = process.env.SHOT_LABEL ?? 'after'
const outDir = `docs/ui-audit/${label}`
const BASE = '/sellbook'

interface Screen {
  name: string
  path: string
  /** Only meaningful on the new build (feature does not exist before). */
  afterOnly?: boolean
  categories?: boolean
  act?: (page: Page) => Promise<void>
}

const orderId = ORDERS[0]?.id ?? ''

const SCREENS: Screen[] = [
  { name: '01-home', path: '/' },
  { name: '02-home-to-prepare', path: '/?view=prep' },
  { name: '03-delivery', path: '/delivery' },
  { name: '04-products', path: '/catalog' },
  { name: '05-products-categories', path: '/catalog', categories: true, afterOnly: true },
  { name: '06-categories-manager', path: '/catalog/categories', categories: true, afterOnly: true },
  { name: '07-product-editor', path: `/catalog/${'00000000-0000-4000-8000-000000000102'}` },
  { name: '08-new-order', path: '/orders/new', categories: true },
  {
    name: '09-new-order-variant-sheet',
    path: '/orders/new',
    afterOnly: true,
    categories: true,
    act: async (page) => {
      await page.getByRole('button', { name: /उपवास भाजणी/ }).click()
    },
  },
  {
    name: '10-new-order-with-items',
    path: '/orders/new',
    afterOnly: true,
    categories: true,
    act: async (page) => {
      await page.getByRole('button', { name: /Modak Pith/ }).click()
      await page.getByRole('button', { name: /One more Modak Pith/ }).click()
      await page.getByRole('button', { name: /कण्हेरी/ }).click()
    },
  },
  { name: '11-order-detail', path: `/orders/${orderId}` },
  {
    name: '12-order-detail-more-actions',
    path: `/orders/${orderId}`,
    afterOnly: true,
    act: async (page) => {
      await page.getByText('More actions').click()
    },
  },
  { name: '13-more', path: '/more' },
  { name: '14-bill-receipt', path: `/orders/${orderId}`, afterOnly: true },
]

test.describe(`screens (${label})`, () => {
  const axeReport: Record<string, unknown> = {}
  const overflow: Record<string, string> = {}

  test.afterAll(() => {
    mkdirSync(outDir, { recursive: true })
    writeFileSync(`${outDir}/axe.json`, JSON.stringify(axeReport, null, 2))
    writeFileSync(`${outDir}/overflow.json`, JSON.stringify(overflow, null, 2))
  })

  for (const s of SCREENS) {
    test(s.name, async ({ page }) => {
      test.skip(s.afterOnly === true && label !== 'after', 'new in this round')
      await signIn(page)
      await mockApi(page, { categories: s.categories ? TEST_CATEGORIES : [] })
      await page.goto(`${BASE}${s.path}`)
      await page.waitForSelector('h1')
      await page.waitForLoadState('networkidle')
      if (s.act) await s.act(page)
      await page.waitForTimeout(300)
      mkdirSync(outDir, { recursive: true })
      await page.screenshot({ path: `${outDir}/${s.name}.png`, fullPage: true })

      // No sideways scrolling at 360 px, nor at 200 % text size.
      const wide = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      const at100 = await wide()
      await page.evaluate(() => (document.documentElement.style.fontSize = '32px'))
      const at200 = await wide()
      await page.evaluate(() => (document.documentElement.style.fontSize = ''))
      overflow[s.name] = `360px: ${at100 > 0 ? `+${at100}px` : 'ok'}; 200% text: ${at200 > 0 ? `+${at200}px` : 'ok'}`

      if (label === 'after') {
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
        axeReport[s.name] = results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.length,
          sample: v.nodes[0]?.html.slice(0, 160),
        }))
        expect(at100, `${s.name} scrolls sideways at 360px`).toBeLessThanOrEqual(0)
      }
    })
  }

  test('order detail uses the customer name as its one h1', async ({ page }) => {
    test.skip(label !== 'after')
    await signIn(page)
    await mockApi(page)
    await page.goto(`${BASE}/orders/${orderId}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(LONG_NAME)
    await expect(page.getByText(/Order #15 ·/)).toBeVisible()
  })

  test('a deep link and a refresh both work under the base path', async ({ page }) => {
    test.skip(label !== 'after')
    await signIn(page)
    await mockApi(page)
    await page.goto(`${BASE}/catalog`)
    await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible()
    await page.goto(`${BASE}/more`)
    await expect(page.getByText(/Version /)).toBeVisible()
  })
})
