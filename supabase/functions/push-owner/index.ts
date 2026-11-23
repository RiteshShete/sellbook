// Edge Function: sends a web-push alert to a shop owner's phones.
//
// Called by the database (trigger on orders, via pg_net) with a shared secret, never by the app. It needs no
// database access: the payload carries the owner's saved devices. Needs no service key.
//
// Secrets (supabase secrets set ...):
//   PUSH_SECRET        same value as the Vault secret "push_secret"
//   VAPID_PUBLIC_KEY   same value as VITE_VAPID_PUBLIC_KEY in the app   (make a pair with: node scripts/gen-vapid.mjs)
//   VAPID_PRIVATE_KEY  the private half; never in the repo
//   VAPID_SUBJECT      mailto:you@example.com  (the push services may contact you)
//   APP_URL            e.g. https://riteshshete.github.io/sellbook
import webpush from 'npm:web-push@3.6.7'
import { notificationJson, parsePayload, safeEqual } from './payload.ts'

const env = (name: string) => Deno.env.get(name) ?? ''

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const secret = env('PUSH_SECRET')
  if (!secret || !safeEqual(req.headers.get('x-push-secret') ?? '', secret)) return new Response('forbidden', { status: 403 })

  const payload = parsePayload(await req.json().catch(() => null))
  if (!payload) return new Response('bad payload', { status: 400 })
  if (!env('VAPID_PUBLIC_KEY') || !env('VAPID_PRIVATE_KEY') || !env('APP_URL')) return new Response('push is not configured', { status: 500 })

  webpush.setVapidDetails(env('VAPID_SUBJECT') || 'mailto:admin@example.com', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
  const message = notificationJson(payload, env('APP_URL'))
  // One dead device must not stop the others. 404/410 = the phone removed the subscription (harmless).
  const results = await Promise.allSettled(
    payload.subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, { TTL: 3600, urgency: 'high' })),
  )
  const sent = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.length - sent
  if (failed) console.error(`push-owner: ${failed} of ${results.length} failed`)
  return new Response(JSON.stringify({ sent, failed }), { headers: { 'Content-Type': 'application/json' } })
})
