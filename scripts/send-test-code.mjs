// Sends ONE password-reset code email through a Supabase project's auth + custom SMTP, to an address that already has an
// account there, and says whether Supabase accepted it. Use it on the TEST project to prove the SMTP settings work
// before real users depend on them. It cannot tell whether the email LANDED (inbox or spam): check the inbox yourself.
//
//   SCRATCH_URL=https://<test-ref>.supabase.co SCRATCH_ANON_KEY=<test anon key> SCRATCH_EMAIL=<your own address> \
//   node scripts/send-test-code.mjs
//
// Anon (public) key only. Refuses the live project in .env.local and makes you type the host back (as auth-scratch.mjs).
import { existsSync, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { createClient } from '@supabase/supabase-js'

const { SCRATCH_URL, SCRATCH_ANON_KEY, SCRATCH_EMAIL } = process.env
if (!SCRATCH_URL || !SCRATCH_ANON_KEY || !SCRATCH_EMAIL) {
  console.error('Set SCRATCH_URL, SCRATCH_ANON_KEY and SCRATCH_EMAIL (see the header of this file).')
  process.exitCode = 2
} else {
  const host = new URL(SCRATCH_URL).host
  let live = null
  if (existsSync('.env.local')) {
    const url = /^VITE_SUPABASE_URL=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1]?.trim()
    live = url ? new URL(url).host : null
  }
  if (live === host) {
    console.error(`REFUSED: ${host} is the project in .env.local (live). Use the TEST project.`)
    process.exitCode = 2
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const typed = (await rl.question(`This will email a reset code to ${SCRATCH_EMAIL} via ${host}. Type that host to continue: `)).trim()
    rl.close()
    if (typed !== host) {
      console.error('Host did not match. Nothing was sent.')
      process.exitCode = 2
    } else {
      const client = createClient(SCRATCH_URL, SCRATCH_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
      const { error } = await client.auth.resetPasswordForEmail(SCRATCH_EMAIL)
      if (error) {
        console.error(`FAILED: ${error.status ?? ''} ${error.code ?? ''} ${error.message}`.trim())
        process.exitCode = 1
      } else {
        console.log('Accepted by Supabase. Now check the inbox (and Spam) for a message with a 6-digit code.')
        console.log('If none arrives in a few minutes: SMTP settings, sender address/domain (SPF, DKIM) or the account does not exist.')
      }
    }
  }
}
