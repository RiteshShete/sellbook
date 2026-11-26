import { execFileSync } from 'node:child_process'
import { crc32, deflateSync } from 'node:zlib'
import { expect, type Page } from '@playwright/test'

/** Shared by the local-stack browser checks (see playwright.local.config.ts). */
export const MAIL = process.env.E2E_MAIL_API ?? 'http://127.0.0.1:54324'
export const rand = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')

/** Runs SQL in the local database container (test setup only). */
export function sql(statement: string): string {
  return execFileSync('docker', ['exec', 'supabase_db_sellbook', 'psql', '-U', 'postgres', '-At', '-c', statement], {
    encoding: 'utf8',
  }).trim()
}

/** The newest 6-digit code mailed to an address (local mail catcher). */
export async function emailedCode(to: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const found = (await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=1`)).json()) as {
      messages?: { ID: string }[]
    }
    const id = found.messages?.[0]?.ID
    if (id) {
      const full = (await (await fetch(`${MAIL}/api/v1/message/${id}`)).json()) as { Text?: string }
      const hit = /\b(\d{6})\b/.exec(full.Text ?? '')
      if (hit?.[1]) return hit[1]
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`no code arrived for ${to}`)
}

/** On a page that shows the recovery-email card: add the email and confirm it with the emailed code. */
export async function addRecoveryEmail(page: Page, email: string) {
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByText('We sent a code to')).toBeVisible()
  await page.getByLabel('Code from the email').fill(await emailedCode(email))
  await page.getByRole('button', { name: 'Confirm email' }).click()
  await expect(page.getByText(`${email} is confirmed.`)).toBeVisible()
}

/** A genuine PNG (a colour gradient) built here, so the browser really has to decode and resize it. */
export function samplePng(size = 600): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const head = Buffer.alloc(4)
    head.writeUInt32BE(data.length)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([head, body, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8-bit RGB
  const rows = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1)
    for (let x = 0; x < size; x++) {
      rows[row + 1 + x * 3] = (x * 255) / size
      rows[row + 2 + x * 3] = (y * 255) / size
      rows[row + 3 + x * 3] = 128
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Sign up an owner by mobile and create their shop with a fresh invite. Returns what later steps need. */
export async function newShopOwner(page: Page, stamp: string) {
  const phone = `9${rand(9)}`
  const password = 'Owner-pass-1'
  const slug = `shop-${stamp}`.slice(0, 30)
  const invite = `S3${stamp.toUpperCase()}`.replace(/[^A-Z0-9]/g, '').padEnd(10, '0').slice(0, 10)
  await page.goto('/signup')
  await page.getByLabel('Email or mobile number').fill(phone)
  await page.getByLabel('Password (at least 8 characters)').fill(password)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/create-shop$/)
  const ownerId = sql(`select id from auth.users where phone = '91${phone}'`)
  sql(`insert into public.shop_invites (code, created_by) values ('${invite}', '${ownerId}')`)
  await page.getByLabel('Shop name').fill(`Shop ${stamp}`)
  await page.getByLabel('Web address').fill(slug)
  await page.getByLabel('Invite code').fill(invite)
  await page.getByRole('button', { name: 'Create my shop' }).click()
  await expect(page).toHaveURL(/\/more/)
  return { phone, password, slug, ownerId }
}
