/**
 * What a customer reads when a storefront call fails (STOREFRONT_PLAN Appendix B). Never mentions plans, owners,
 * other shops or SQL. SB421 (minimum order) and SB423 (date) keep the server's own sentence because it names the
 * amount or the date; SB427 never does (it can quote an unexpected field).
 */
const FIXED: Record<string, string> = {
  SB420: "This shop can't take orders right now.",
  SB422: 'Some items are no longer available.',
  SB424: 'Please wait until your earlier orders are completed.',
  SB425: "This can't be done at this stage.",
  SB426: "This shop can't take your order.",
  SB427: 'Please check your order and try again.',
  SB428: "This invite code isn't valid.",
  SB429: 'Too many orders today. Try again tomorrow.',
  P0002: "We couldn't find that.",
  '42501': "You can't do that with this account.",
}

export const GENERIC_ERROR = 'Something went wrong. Please try again.'

export function customerErrorMessage(err: unknown): string {
  const e = (typeof err === 'object' && err !== null ? err : {}) as { code?: unknown; message?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''
  const message = typeof e.message === 'string' ? e.message.trim() : ''
  if ((code === 'SB421' || code === 'SB423') && message) {
    return message.charAt(0).toUpperCase() + message.slice(1) + '.'
  }
  return FIXED[code] ?? GENERIC_ERROR
}
