// Edge Function: emails the platform admin when a shop files a plan payment claim.
//
// Called by the database (trigger on subscription_requests, via pg_net) with a shared secret, never by
// the app. It needs no database access and no service key: the payload carries everything.
//
// Secrets (supabase secrets set ...; locally an --env-file outside the repo):
//   NOTIFY_SECRET  same value as the Vault secret "notify_admin_secret"
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS   e.g. smtp.gmail.com, 465, the Gmail address, its app password
//   MAIL_FROM      optional; defaults to SMTP_USER
//   ADMIN_EMAIL    where the notice goes
//   APP_URL        e.g. https://riteshshete.github.io/sellbook
import nodemailer from 'npm:nodemailer@6.9.16'
import { buildMail, parsePayload, safeEqual } from './mail.ts'

const env = (name: string) => Deno.env.get(name) ?? ''

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const secret = env('NOTIFY_SECRET')
  if (!secret || !safeEqual(req.headers.get('x-notify-secret') ?? '', secret)) {
    return new Response('forbidden', { status: 403 })
  }

  const payload = parsePayload(await req.json().catch(() => null))
  if (!payload) return new Response('bad payload', { status: 400 })

  const port = Number(env('SMTP_PORT') || 465)
  const user = env('SMTP_USER')
  const to = env('ADMIN_EMAIL')
  if (!env('SMTP_HOST') || !to) return new Response('mail is not configured', { status: 500 })

  try {
    const transport = nodemailer.createTransport({
      host: env('SMTP_HOST'),
      port,
      secure: port === 465,
      auth: user ? { user, pass: env('SMTP_PASS') } : undefined,
    })
    await transport.sendMail({ from: env('MAIL_FROM') || user, to, ...buildMail(payload, env('APP_URL')) })
    return new Response('sent')
  } catch (e) {
    // The claim is already saved and listed on the Admin page; a lost email loses nothing.
    console.error('notify-admin: send failed', e instanceof Error ? e.message : e)
    return new Response('send failed', { status: 502 })
  }
})
