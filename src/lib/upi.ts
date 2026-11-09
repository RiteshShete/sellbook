import { paiseToDecimalString, type Paise } from './money'

/** A VPA (UPI ID): name@bank, as NPCI allows. */
export const VPA_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/

export function isValidVpa(vpa: string): boolean {
  return VPA_PATTERN.test(vpa)
}

/** UPI apps may refuse (or warn on) payments above this; the order form warns the owner (Rs 1,00,000). */
export const UPI_LIMIT_PAISE: Paise = 10_000_000

/** Longest note we send; UPI apps cut or reject long notes. Keeps the "tn" short and ASCII. */
const NOTE_MAX = 40

export interface UpiPayment {
  /** The owner's UPI ID, e.g. "shop@okicici". */
  vpa: string
  /** Payee name shown in the payer's app (Devanagari is passed through, percent-encoded). */
  payeeName: string
  /** What is still payable, in integer paise. Must be above zero. */
  amount: Paise
  /** Shown in the payer's UPI app, e.g. "Bill INV-0012". */
  note: string
}

/** encodeURIComponent plus the five characters it leaves bare (! ' ( ) *), which some UPI apps trip on. */
function encodeValue(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

/** The note for a bill: "Bill INV-0012", ASCII only and short. */
export function upiNote(billNo: string): string {
  const ascii = `Bill ${billNo}`
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return ascii.slice(0, NOTE_MAX).trim()
}

/**
 * The upi://pay deep link (NPCI format) the QR encodes: pa, pn, am, cu, tn. No tr or mc: those
 * are for registered merchants. Every value is percent-encoded (spaces are %20, never "+"), and the
 * amount is exact two-decimal text built from integer paise, never from floating point.
 * Throws for input no UPI app would accept; use upiLinkForBill for "no QR needed" cases.
 */
export function buildUpiUri(p: UpiPayment): string {
  const vpa = p.vpa.trim()
  const name = p.payeeName.trim().replace(/\s+/g, ' ')
  if (!isValidVpa(vpa)) throw new RangeError(`Not a valid UPI ID: "${vpa}"`)
  if (!name) throw new RangeError('A payee name is required')
  if (!Number.isInteger(p.amount) || p.amount <= 0) {
    throw new RangeError('The amount must be above zero')
  }
  const query = [
    ['pa', vpa],
    ['pn', name],
    ['am', paiseToDecimalString(p.amount)],
    ['cu', 'INR'],
    ['tn', p.note],
  ]
    .map(([k, v]) => `${k}=${encodeValue(v ?? '')}`)
    .join('&')
  return `upi://pay?${query}`
}

// ---- Which QR does a bill get? --------------------------------------------------------------------

/** The settings that decide the bill's QR. */
export interface QrSettings {
  upi_id: string | null
  payee_name: string | null
  use_dynamic_qr: boolean
  qr_path: string | null
}

export type QrMode = 'dynamic' | 'uploaded' | 'none'

/** Dynamic QR needs the switch on, a valid UPI ID and a payee name; else the uploaded image, else none. */
export function qrMode(s: QrSettings): QrMode {
  const dynamicReady =
    s.use_dynamic_qr && isValidVpa((s.upi_id ?? '').trim()) && (s.payee_name ?? '').trim() !== ''
  if (dynamicReady) return 'dynamic'
  return s.qr_path ? 'uploaded' : 'none'
}

/**
 * The pay link for one bill, or null when there is nothing to pay by UPI: not in dynamic mode, the
 * order is already paid, or the amount is zero. (A paid bill shows PAID instead of a QR.)
 */
export function upiLinkForBill(opts: {
  settings: QrSettings
  billNo: string
  amount: Paise
  paid: boolean
}): string | null {
  const { settings, billNo, amount, paid } = opts
  if (paid || amount <= 0 || qrMode(settings) !== 'dynamic') return null
  return buildUpiUri({
    vpa: settings.upi_id ?? '',
    payeeName: settings.payee_name ?? '',
    amount,
    note: upiNote(billNo),
  })
}

/** The message sent with the bill: who, how much, and the UPI link when there is one. */
export function billMessage(opts: {
  customerName: string
  shopName: string
  billNo: string
  totalText: string
  upiLink: string | null
  /** The order is already paid: say so instead of asking for money. */
  paid?: boolean
}): string {
  const lines = [
    `Hi ${opts.customerName}, here is your bill ${opts.billNo} from ${opts.shopName || 'us'}.`,
    `Amount: ${opts.totalText}`,
  ]
  if (opts.paid) lines.push('', 'Payment received. Thank you!')
  else if (opts.upiLink)
    lines.push('', `Pay by UPI: ${opts.upiLink}`, 'or scan the QR on the bill.')
  else lines.push('', 'Scan the QR on the bill to pay.')
  return lines.join('\n')
}
