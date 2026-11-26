/**
 * Pure parts of the "a shop says it paid" email. No Deno or npm imports here, so the same file runs in the
 * Edge Function and in the app's unit tests (src/features/admin/notifyMail.test.ts).
 */

export interface ClaimPayload {
  id: string
  shop_name: string
  email: string
  tier: 'base' | 'pro'
  amount_paise: number
  ref_code: string
  utr: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The trigger's JSON, checked field by field; null = not something we sent. */
export function parsePayload(input: unknown): ClaimPayload | null {
  if (typeof input !== 'object' || input === null) return null
  // Narrowed to a non-null object above; every field is checked before use.
  const o = input as Record<string, unknown>
  const { id, shop_name, email, tier, amount_paise, ref_code, utr } = o
  if (typeof id !== 'string' || !UUID.test(id)) return null
  if (typeof shop_name !== 'string' || shop_name.length > 200) return null
  if (typeof email !== 'string' || email.length > 320) return null
  if (tier !== 'base' && tier !== 'pro') return null
  if (typeof amount_paise !== 'number' || !Number.isSafeInteger(amount_paise) || amount_paise <= 0) return null
  if (typeof ref_code !== 'string' || !/^SB-[0-9A-F]{8}$/.test(ref_code)) return null
  if (utr !== null && (typeof utr !== 'string' || !/^[A-Za-z0-9]{6,30}$/.test(utr))) return null
  return { id, shop_name, email, tier, amount_paise, ref_code, utr }
}

/** Compares without stopping at the first different character (the shared secret must not leak by timing). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Integer paise -> "Rs 100" / "Rs 99.50", with integer math only. */
function rupees(paise: number): string {
  const whole = Math.trunc(paise / 100)
  const rest = paise % 100
  return `Rs ${whole}${rest === 0 ? '' : `.${String(rest).padStart(2, '0')}`}`
}

/** The email to the admin. It is a notice with a link to the Admin page; it approves nothing by itself. */
export function buildMail(p: ClaimPayload, appUrl: string): { subject: string; text: string; html: string } {
  const plan = p.tier === 'pro' ? 'Pro' : 'Base'
  const shop = p.shop_name.trim() || p.email
  const link = `${appUrl.replace(/\/+$/, '')}/admin?req=${p.id}`
  const rows: [string, string][] = [
    ['Shop', shop],
    ['Email', p.email],
    ['Plan', plan],
    ['Amount', rupees(p.amount_paise)],
    ['Reference', p.ref_code],
    ['UTR', p.utr ?? 'not given'],
  ]
  const warning = 'Approve only after you see the money in your account with this reference.'
  return {
    // Fixed shape, no line breaks from user text (shop names cannot inject headers).
    subject: `Sellbook: ${rupees(p.amount_paise)} claimed for ${plan} by ${shop}`.replace(/[\r\n]+/g, ' '),
    text: [
      'A shop says it has paid for a plan.',
      '',
      ...rows.map(([k, v]) => `${k}: ${v}`),
      '',
      `Review and approve: ${link}`,
      '',
      warning,
    ].join('\n'),
    html:
      `<p>A shop says it has paid for a plan.</p><table>` +
      rows.map(([k, v]) => `<tr><td>${k}</td><td><b>${escapeHtml(v)}</b></td></tr>`).join('') +
      `</table><p><a href="${escapeHtml(link)}">Review and approve</a></p><p>${warning}</p>`,
  }
}
