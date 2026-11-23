/** The bank reference (UTR) a customer may add when they say they paid: 12 digits, or nothing. Paste-friendly. */
export const cleanUtr = (text: string): string => text.replace(/\D/g, '').slice(0, 12)

/** A message when the text is neither empty nor a full 12-digit UTR; null when it is fine to send. */
export function utrProblem(text: string): 'incomplete' | null {
  const digits = cleanUtr(text)
  return digits === '' || digits.length === 12 ? null : 'incomplete'
}
