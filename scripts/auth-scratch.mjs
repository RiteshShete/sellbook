// Storefront S0 auth scratch test: decides whether phone + password, the emailed 6-digit code and
// Google sign-in work on a Supabase project WITHOUT an SMS provider. Run against the TEST project only.
//
//   SCRATCH_URL=https://<test-ref>.supabase.co SCRATCH_ANON_KEY=<test anon key> \
//   SCRATCH_EMAIL=<an inbox you can read> node scripts/auth-scratch.mjs
//
// LOCAL STACK, unattended: also set SCRATCH_MAIL_API=http://127.0.0.1:54324 (the local mail catcher) and the script
// reads each 6-digit code itself instead of asking you. Never set it for a hosted project.
// Anon (public) key only, never an admin or secret key. Test users stay on the TEST project afterwards.
// It refuses to run against the URL in .env.local (the live project) and makes you type the host back.
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { createClient } from '@supabase/supabase-js'

const { SCRATCH_URL, SCRATCH_ANON_KEY, SCRATCH_EMAIL } = process.env
if (!SCRATCH_URL || !SCRATCH_ANON_KEY || !SCRATCH_EMAIL) {
  console.error('Set SCRATCH_URL, SCRATCH_ANON_KEY and SCRATCH_EMAIL (see the header of this file).')
  process.exit(2)
}
const host = new URL(SCRATCH_URL).host
if (existsSync('.env.local')) {
  const live = /^VITE_SUPABASE_URL=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1]?.trim()
  if (live && new URL(live).host === host) {
    console.error(`REFUSED: ${host} is the project in .env.local (live). Use the TEST project.`)
    process.exit(2)
  }
}
const rl = createInterface({ input: process.stdin, output: process.stdout })
const confirmed = (await rl.question(`This will create test users on ${host}. Type that host to continue: `)).trim() === host
if (!confirmed) {
  console.error('Host did not match. Nothing was done.')
  rl.close()
  process.exitCode = 2
}

async function run() {
const rnd = (n) => Array.from(randomBytes(n), (b) => b % 10).join('')
const phone1 = process.env.SCRATCH_PHONE ?? `+919${rnd(9)}`
const phone2 = `+919${rnd(9)}`
const password = randomBytes(12).toString('base64url')
const newPassword = randomBytes(12).toString('base64url')
const fresh = () =>
  createClient(SCRATCH_URL, SCRATCH_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const msg = (e) => (e ? `${e.status ?? ''} ${e.code ?? ''} ${e.message}`.trim() : 'no error')
const mailApi = process.env.SCRATCH_MAIL_API
const seenMail = new Set()
/** Local mail catcher (Mailpit): newest message for the address that we have not used yet, 6-digit code from its text. */
async function codeFromMailApi() {
  for (let i = 0; i < 30; i++) {
    const found = await (await fetch(`${mailApi}/api/v1/search?query=${encodeURIComponent(`to:${SCRATCH_EMAIL}`)}&limit=5`)).json()
    const msg = (found.messages ?? []).find((m) => !seenMail.has(m.ID))
    if (msg) {
      seenMail.add(msg.ID)
      const full = await (await fetch(`${mailApi}/api/v1/message/${msg.ID}`)).json()
      const hit = /\b(\d{6})\b/.exec(full.Text ?? '')
      if (hit) return hit[1]
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('no email with a 6-digit code arrived in 30 seconds')
}
const code = async (what) =>
  mailApi ? codeFromMailApi() : (await rl.question(`Enter the 6-digit code from the ${what} email: `)).trim()

const results = []
async function step(id, name, fn) {
  try {
    const [ok, detail] = await fn()
    results.push({ id, name, ok, detail })
  } catch (e) {
    results.push({ id, name, ok: false, detail: `threw: ${e instanceof Error ? e.message : String(e)}` })
  }
  const r = results[results.length - 1]
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${id}  ${name}  -  ${r.detail}`)
  return r.ok
}

const c = fresh()
console.log(`\nProject ${host}\nPhone 1 ${phone1}  Phone 2 ${phone2}  Email ${SCRATCH_EMAIL}\n`)

const a = await step('a', 'phone + password sign-up returns a session (no SMS)', async () => {
  const { data, error } = await c.auth.signUp({ phone: phone1, password })
  return [Boolean(data.session), error ? msg(error) : `session=${Boolean(data.session)} user=${Boolean(data.user)}`]
})

if (a) {
  await step('b', 'same number again gives a clear "already registered" signal', async () => {
    const { data, error } = await fresh().auth.signUp({ phone: phone1, password })
    // Supabase may hide the duplicate: record exactly what happens, the app must cope either way.
    return [Boolean(error) || !data.session, error ? msg(error) : `no error, session=${Boolean(data.session)}`]
  })
}

if (a) {
  const sent = await step('c1', 'updateUser({email}) sends a code', async () => {
    const { error } = await c.auth.updateUser({ email: SCRATCH_EMAIL })
    return [!error, msg(error)]
  })
  if (sent) {
    await step('c2', 'verifyOtp(email_change) confirms the email', async () => {
      const { error } = await c.auth.verifyOtp({
        email: SCRATCH_EMAIL,
        token: await code('"confirm email change"'),
        type: 'email_change',
      })
      return [!error, msg(error)]
    })
  }
  await c.auth.signOut()
  await step('d', 'phone + password sign-in still works with the email attached', async () => {
    const { data, error } = await c.auth.signInWithPassword({ phone: phone1, password })
    return [Boolean(data.session), msg(error)]
  })
  await c.auth.signOut()

  const reset = await step('e1', 'resetPasswordForEmail sends a code', async () => {
    const { error } = await c.auth.resetPasswordForEmail(SCRATCH_EMAIL)
    return [!error, msg(error)]
  })
  if (reset) {
    await step('e2', 'recovery code + new password, then the new password signs in', async () => {
      const v = await c.auth.verifyOtp({
        email: SCRATCH_EMAIL,
        token: await code('"reset password"'),
        type: 'recovery',
      })
      if (v.error) return [false, msg(v.error)]
      const u = await c.auth.updateUser({ password: newPassword })
      if (u.error) return [false, msg(u.error)]
      await c.auth.signOut()
      const s = await c.auth.signInWithPassword({ phone: phone1, password: newPassword })
      return [Boolean(s.data.session), msg(s.error)]
    })
  }

  await step('f', 'the same email cannot be attached to a second account', async () => {
    const c2 = fresh()
    const up = await c2.auth.signUp({ phone: phone2, password })
    if (!up.data.session) return [false, `second sign-up gave no session: ${msg(up.error)}`]
    const { error } = await c2.auth.updateUser({ email: SCRATCH_EMAIL })
    return [Boolean(error), error ? msg(error) : 'accepted (BAD: duplicate email allowed, or it only fails at confirmation)']
  })
}

await step('g', 'reset for an unknown email looks the same as for a known one', async () => {
  const unknown = `nobody-${rnd(8)}@example.invalid`
  const [k, u] = await Promise.all([
    fresh().auth.resetPasswordForEmail(SCRATCH_EMAIL),
    fresh().auth.resetPasswordForEmail(unknown),
  ])
  return [Boolean(k.error) === Boolean(u.error), `known: ${msg(k.error)} | unknown: ${msg(u.error)}`]
})

await step('h', 'Google provider is enabled (the sign-in link redirects to Google; finishing needs a browser)', async () => {
  const { data, error } = await fresh().auth.signInWithOAuth({
    provider: 'google',
    options: { skipBrowserRedirect: true, redirectTo: 'http://localhost:5173/' },
  })
  if (error || !data?.url) return [false, msg(error)]
  // Building the link proves nothing: follow the FIRST hop only. An enabled provider answers with a redirect to Google.
  const res = await fetch(data.url, { redirect: 'manual' })
  const where = res.headers.get('location')
  const toGoogle = res.status >= 300 && res.status < 400 && where !== null && new URL(where).host.endsWith('google.com')
  return [toGoogle, toGoogle ? 'redirects to Google' : `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`]
})

rl.close()
console.log('\nSummary')
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.name}`)
console.log('\nDecision rule (plan 8.1): if a or d FAIL, stop and ask the owner; do not switch silently.')
console.log('Google: open the h link in a browser to prove the whole round trip; this script cannot.')
process.exitCode = results.every((r) => r.ok) ? 0 : 1
}
if (confirmed) await run()
