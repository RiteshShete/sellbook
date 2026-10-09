import { paiseToDecimalString, type Paise } from './money'

export interface UpiPayment {
  upiId: string
  payeeName: string
  amount: Paise
  /** Shown in the payer's UPI app, e.g. "Bill INV-0007". */
  note: string
}

/**
 * upi://pay deep link (NPCI format). Opens the payer's UPI app with the amount filled in.
 * The app never checks whether it was paid; the owner marks payment by hand.
 */
export function upiPayLink(p: UpiPayment): string {
  const params = new URLSearchParams({
    pa: p.upiId,
    pn: p.payeeName,
    am: paiseToDecimalString(p.amount),
    cu: 'INR',
    tn: p.note,
  })
  // URLSearchParams encodes spaces as '+', which some UPI apps show literally.
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`
}

/** The message sent with the bill: who, how much, and the UPI link when there is a UPI id. */
export function billMessage(opts: {
  customerName: string
  shopName: string
  billNo: string
  totalText: string
  upiLink: string | null
}): string {
  const lines = [
    `Hi ${opts.customerName}, here is your bill ${opts.billNo} from ${opts.shopName || 'us'}.`,
    `Amount: ${opts.totalText}`,
  ]
  if (opts.upiLink) lines.push('', `Pay by UPI: ${opts.upiLink}`, 'or scan the QR on the bill.')
  else lines.push('', 'Scan the QR on the bill to pay.')
  return lines.join('\n')
}
