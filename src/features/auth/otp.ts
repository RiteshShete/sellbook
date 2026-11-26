/** The 6-digit emailed code: pure helpers for the input box and the resend timer. */
export const OTP_LENGTH = 6
export const RESEND_SECONDS = 60

/** Keeps digits only (also Devanagari digits from a Marathi keyboard), at most 6. */
export function cleanOtp(input: string): string {
  const ascii = input.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
  return ascii.replace(/\D/g, '').slice(0, OTP_LENGTH)
}

export const isOtpComplete = (code: string) => code.length === OTP_LENGTH

/** Seconds until "Resend" is allowed again; 0 when it is. `sentAt` and `now` are epoch milliseconds. */
export function resendSecondsLeft(sentAt: number, now: number, wait = RESEND_SECONDS): number {
  return Math.min(wait, Math.max(0, Math.ceil(wait - (now - sentAt) / 1000)))
}

/** Where each digit of the code goes in the six boxes (shorter codes leave later boxes empty). */
export const otpDigits = (code: string): string[] => Array.from({ length: OTP_LENGTH }, (_, i) => code[i] ?? '')
