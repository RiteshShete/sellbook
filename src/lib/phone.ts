/**
 * Indian mobile numbers. normalizePhone returns digits only with country code,
 * e.g. "919876543210", or null when the input is not a valid Indian mobile number.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^0+/, '')
  let national: string
  if (digits.length === 10) national = digits
  else if (digits.length === 12 && digits.startsWith('91')) national = digits.slice(2)
  else return null
  return /^[6-9]\d{9}$/.test(national) ? `91${national}` : null
}

/** wa.me chat link (text only; WhatsApp cannot receive a file via URL). null if phone invalid. */
export function toWaMeLink(phone: string, text?: string): string | null {
  const normalized = normalizePhone(phone)
  if (!normalized) return null
  const base = `https://wa.me/${normalized}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}
