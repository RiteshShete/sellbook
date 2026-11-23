// Pure helpers for the push-owner Edge Function (no Deno imports, so Vitest can test them).
export interface PushSub {
  endpoint: string
  p256dh: string
  auth: string
}
export interface PushPayload {
  title: string
  body: string
  path: string
  tag: string
  subs: PushSub[]
}

const str = (v: unknown, min: number, max: number): v is string => typeof v === 'string' && v.length >= min && v.length <= max

/** The database's request, or null if it is not exactly what the trigger sends. */
export function parsePayload(raw: unknown): PushPayload | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (!str(r.title, 1, 80) || !str(r.body, 1, 200) || !str(r.path, 0, 100) || !/^[A-Za-z0-9/_-]*$/.test(r.path) || !str(r.tag, 0, 100)) return null
  if (!Array.isArray(r.subs) || r.subs.length < 1 || r.subs.length > 10) return null
  const subs: PushSub[] = []
  for (const s of r.subs) {
    if (typeof s !== 'object' || s === null) return null
    const { endpoint, p256dh, auth } = s as Record<string, unknown>
    if (!str(endpoint, 9, 1000) || !endpoint.startsWith('https://') || !str(p256dh, 20, 200) || !str(auth, 8, 100)) return null
    subs.push({ endpoint, p256dh, auth })
  }
  return { title: r.title, body: r.body, path: r.path, tag: r.tag, subs }
}

/** The JSON the service worker receives. `url` is absolute so a tap opens the right page. */
export function notificationJson(p: PushPayload, appUrl: string): string {
  const base = appUrl.replace(/\/+$/, '')
  return JSON.stringify({ title: p.title, body: p.body, tag: p.tag, url: `${base}/${p.path}` })
}

/** Constant-time comparison for the shared secret. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
