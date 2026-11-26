import { expect, test } from '@playwright/test'
import { addRecoveryEmail, emailedCode, rand, sql } from './helpers'

/**
 * STOREFRONT_PLAN S2 "definition of done", on a phone-sized screen against the local stack:
 * register an owner and create a shop with an invite; register a customer on that storefront; add and confirm an
 * email by code; reset a password by code; sign in again.
 */
const stamp = Date.now().toString(36)

const owner = { phone: `9${rand(9)}`, password: 'Owner-pass-1', email: `owner-${stamp}@example.test`, newPassword: 'Owner-pass-2' }
const customer = { phone: `9${rand(9)}`, name: 'Asha Patil', password: 'Cust-pass-1', email: `cust-${stamp}@example.test` }
const shop = { name: `E2E Foods ${stamp}`, slug: `e2e-${stamp}`.slice(0, 30), invite: `E2E${stamp.toUpperCase()}`.replace(/[^A-Z0-9]/g, '').padEnd(10, '0').slice(0, 10) }

test.describe.serial('S2 sign-in screens on the local stack', () => {
  test('owner: sign up by mobile, create the shop with an invite code', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel('Email or mobile number').fill(owner.phone)
    await page.getByLabel('Password (at least 8 characters)').fill(owner.password)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/create-shop$/)

    // an admin would hand out the invite: created here as the new account (test setup only)
    const ownerId = sql(`select id from auth.users where phone = '91${owner.phone}'`)
    expect(ownerId).toMatch(/^[0-9a-f-]{36}$/)
    sql(`insert into public.shop_invites (code, created_by) values ('${shop.invite}', '${ownerId}')`)

    await page.getByLabel('Shop name').fill(shop.name)
    await page.getByLabel('Web address').fill(shop.slug)
    await expect(page.getByText(/Free\. Your link:/)).toBeVisible()
    await page.getByLabel('Invite code').fill(shop.invite)
    await page.getByRole('button', { name: 'Create my shop' }).click()
    await expect(page).toHaveURL(/\/more/)
    expect(sql(`select slug from public.shops where owner_id = '${ownerId}'`)).toBe(shop.slug)
  })

  test('owner: a wrong invite and a taken or reserved address are refused with clear messages', async ({ page, context }) => {
    // a second account, so the first account's shop does not interfere
    await context.clearCookies()
    await page.goto('/signup')
    await page.getByLabel('Email or mobile number').fill(`9${rand(9)}`)
    await page.getByLabel('Password (at least 8 characters)').fill('Second-pass-1')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/create-shop$/)

    await page.getByLabel('Shop name').fill('Another Shop')
    await page.getByLabel('Web address').fill('orders')
    await expect(page.getByText('That address is reserved. Please choose another.')).toBeVisible()
    await page.getByLabel('Web address').fill(shop.slug)
    await expect(page.getByText('That address is already taken. Try another.')).toBeVisible()
    await page.getByLabel('Web address').fill(`other-${stamp}`.slice(0, 30))
    await page.getByLabel('Invite code').fill('WRONGCODE1')
    await page.getByRole('button', { name: 'Create my shop' }).click()
    await expect(page.getByText("This invite code isn't valid.").first()).toBeVisible() // inline + the standard error toast
  })

  test('owner: add a recovery email by code, then reset the password by code and sign in again', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email or mobile number').fill(owner.phone)
    await page.getByLabel('Password').fill(owner.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/account')
    await addRecoveryEmail(page, owner.email)

    // sign out, forgot password by code
    await page.goto('/more')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/forgot')
    await page.getByLabel('Email', { exact: true }).fill(owner.email)
    await page.getByRole('button', { name: 'Send code' }).click()
    await expect(page.getByText(/we sent a 6-digit code/)).toBeVisible()
    await page.getByLabel('Code from the email').fill(await emailedCode(owner.email))
    await page.getByLabel('New password (at least 8 characters)').fill(owner.newPassword)
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page).toHaveURL(/\/$/)

    // the old password no longer works, the new one does, by mobile number
    await page.goto('/more')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByLabel('Email or mobile number').fill(owner.phone)
    await page.getByLabel('Password').fill(owner.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Wrong email, mobile number or password.').first()).toBeVisible()
    await page.getByLabel('Password').fill(owner.newPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/more$/) // sent back to the page the sign-out happened on
  })

  test('customer: sign up on the storefront, finish, stay out of the owner app', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto(`/${shop.slug}/signup`)
    await page.getByLabel('Your name', { exact: true }).fill(customer.name)
    await page.getByLabel('Mobile number', { exact: true }).fill(customer.phone)
    await page.getByLabel('Password (at least 8 characters)').fill(customer.password)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(new RegExp(`/${shop.slug}/products$`))

    expect(sql(`select name || '/' || phone from public.customer_profiles where phone = '91${customer.phone}'`)).toBe(
      `${customer.name}/91${customer.phone}`,
    )
    // the sign-up trigger's trial row is removed for a customer
    expect(sql(`select count(*) from public.subscriptions s join auth.users u on u.id = s.owner_id where u.phone = '91${customer.phone}'`)).toBe('0')

    // the owner app is not for customers
    await page.goto('/')
    await expect(page.getByText('This account has no shop')).toBeVisible()
  })

  test('customer: the same number cannot sign up twice; account page; email by code; sign in again', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto(`/${shop.slug}/signup`)
    await page.getByLabel('Your name', { exact: true }).fill('Someone Else')
    await page.getByLabel('Mobile number', { exact: true }).fill(customer.phone)
    await page.getByLabel('Password (at least 8 characters)').fill('Another-pass-1')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText(/already has an account/).first()).toBeVisible()

    await page.goto(`/${shop.slug}/login`)
    await page.getByLabel('Mobile number or email').fill(customer.phone)
    await page.getByLabel('Password').fill(customer.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(new RegExp(`/${shop.slug}/products$`))

    await page.goto(`/${shop.slug}/account`)
    await expect(page.getByText(customer.name)).toBeVisible()
    await expect(page.getByText(`+91${customer.phone}`)).toBeVisible()
    await expect(page.getByText('Add and confirm an email so you can reset your password.')).toBeVisible()
    await addRecoveryEmail(page, customer.email)
    await expect(page.getByText('Add and confirm an email so you can reset your password.')).toBeHidden()
  })
})
