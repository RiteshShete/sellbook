import { describe, expect, it } from 'vitest'
import { toPaise } from './money'
import {
  billMessage,
  buildUpiUri,
  isValidVpa,
  qrMode,
  upiLinkForBill,
  upiNote,
  type QrSettings,
} from './upi'

const base = { vpa: 'shop@okicici', payeeName: 'Asha Cakes', note: 'Bill INV-0012' }

describe('buildUpiUri', () => {
  it('builds pa, pn, am, cu, tn in that order, all percent-encoded', () => {
    expect(buildUpiUri({ ...base, amount: toPaise(700) })).toBe(
      'upi://pay?pa=shop%40okicici&pn=Asha%20Cakes&am=700.00&cu=INR&tn=Bill%20INV-0012',
    )
  })

  it('never uses "+" for spaces', () => {
    expect(buildUpiUri({ ...base, amount: 100 })).not.toContain('+')
  })

  it('writes the amount with exactly two decimals and no commas', () => {
    expect(buildUpiUri({ ...base, amount: toPaise(1250.5) })).toContain('&am=1250.50&')
    expect(buildUpiUri({ ...base, amount: toPaise(1234567.8) })).toContain('&am=1234567.80&')
    expect(buildUpiUri({ ...base, amount: 5 })).toContain('&am=0.05&')
  })

  it('is exact where floats are not: 0.1 + 0.2 is 0.30', () => {
    expect(0.1 + 0.2).not.toBe(0.3) // the trap
    expect(buildUpiUri({ ...base, amount: toPaise(0.1 + 0.2) })).toContain('&am=0.30&')
  })

  it('always says INR and adds no tr or mc (registered-merchant fields)', () => {
    const uri = buildUpiUri({ ...base, amount: 100 })
    expect(uri).toContain('&cu=INR&')
    expect(uri).not.toMatch(/[?&](tr|mc)=/)
  })

  it('percent-encodes a Devanagari payee name as UTF-8', () => {
    const uri = buildUpiUri({ ...base, payeeName: 'आशा केक्स', amount: 100 })
    expect(uri).toContain(`pn=${encodeURIComponent('आशा केक्स')}`)
    expect(uri).toMatch(/^[\x21-\x7e]+$/) // the whole link is plain ASCII
  })

  it('encodes characters encodeURIComponent leaves bare, and & = ? # in names', () => {
    const uri = buildUpiUri({ ...base, payeeName: "D'Souza & Sons (Pune)*!", amount: 100 })
    expect(uri).toContain('pn=D%27Souza%20%26%20Sons%20%28Pune%29%2A%21&')
  })

  it('trims the name and collapses inner spaces', () => {
    expect(buildUpiUri({ ...base, payeeName: '  Asha   Cakes ', amount: 100 })).toContain(
      'pn=Asha%20Cakes&',
    )
  })

  it('refuses input no UPI app would accept', () => {
    expect(() => buildUpiUri({ ...base, amount: 0 })).toThrow()
    expect(() => buildUpiUri({ ...base, amount: -100 })).toThrow()
    expect(() => buildUpiUri({ ...base, amount: 10.5 })).toThrow()
    expect(() => buildUpiUri({ ...base, vpa: 'not a vpa', amount: 100 })).toThrow()
    expect(() => buildUpiUri({ ...base, payeeName: '  ', amount: 100 })).toThrow()
  })
})

describe('upiNote', () => {
  it('is "Bill <number>", ASCII only and at most 40 characters', () => {
    expect(upiNote('INV-0012')).toBe('Bill INV-0012')
    expect(upiNote('आशा-1')).toBe('Bill -1')
    expect(upiNote('X'.repeat(80)).length).toBeLessThanOrEqual(40)
  })
})

describe('isValidVpa', () => {
  it.each(['shop@okicici', 'a.b-c_d@ybl', '9876543210@paytm', 'ab@xy'])('accepts %s', (v) => {
    expect(isValidVpa(v)).toBe(true)
  })
  it.each([
    '',
    'shop',
    'shop@',
    '@bank',
    'a@b',
    'sh op@bank',
    'shop@bank1',
    'shop@@bank',
    'x@ybl ',
  ])('rejects "%s"', (v) => {
    expect(isValidVpa(v)).toBe(false)
  })
})

const dyn: QrSettings = {
  upi_id: 'shop@okicici',
  payee_name: 'Asha Cakes',
  use_dynamic_qr: true,
  qr_path: null,
}

describe('qrMode', () => {
  it('is dynamic with the switch on, a valid UPI ID and a payee name', () => {
    expect(qrMode(dyn)).toBe('dynamic')
    expect(qrMode({ ...dyn, qr_path: 'x/qr.png' })).toBe('dynamic') // dynamic wins over the upload
  })
  it('falls back to the uploaded QR, then to none', () => {
    expect(qrMode({ ...dyn, use_dynamic_qr: false, qr_path: 'x/qr.png' })).toBe('uploaded')
    expect(qrMode({ ...dyn, payee_name: '', qr_path: 'x/qr.png' })).toBe('uploaded')
    expect(qrMode({ ...dyn, upi_id: 'bad', qr_path: 'x/qr.png' })).toBe('uploaded')
    expect(qrMode({ ...dyn, use_dynamic_qr: false })).toBe('none')
    expect(qrMode({ ...dyn, upi_id: null })).toBe('none')
  })
})

describe('upiLinkForBill (QR omitted when nothing is payable)', () => {
  const bill = { settings: dyn, billNo: 'INV-0012', amount: toPaise(700), paid: false }

  it('gives the link for an unpaid order with an amount', () => {
    expect(upiLinkForBill(bill)).toBe(
      'upi://pay?pa=shop%40okicici&pn=Asha%20Cakes&am=700.00&cu=INR&tn=Bill%20INV-0012',
    )
  })
  it('gives none when the order is paid', () => {
    expect(upiLinkForBill({ ...bill, paid: true })).toBeNull()
  })
  it('gives none when the amount is zero', () => {
    expect(upiLinkForBill({ ...bill, amount: 0 })).toBeNull()
  })
  it('gives none when the mode is not dynamic', () => {
    expect(upiLinkForBill({ ...bill, settings: { ...dyn, use_dynamic_qr: false } })).toBeNull()
  })
})

describe('billMessage', () => {
  const msg = {
    customerName: 'Ravi',
    shopName: 'Asha Cakes',
    billNo: 'INV-0007',
    totalText: '₹500',
  }
  it('includes the UPI link when there is one', () => {
    const m = billMessage({ ...msg, upiLink: 'upi://pay?pa=x' })
    expect(m).toContain('bill INV-0007 from Asha Cakes')
    expect(m).toContain('Amount: ₹500')
    expect(m).toContain('Pay by UPI: upi://pay?pa=x')
  })
  it('falls back to the QR without a UPI link', () => {
    expect(billMessage({ ...msg, upiLink: null })).toContain('Scan the QR on the bill to pay.')
  })
  it('thanks instead of asking for money when already paid', () => {
    const m = billMessage({ ...msg, upiLink: null, paid: true })
    expect(m).toContain('Payment received')
    expect(m).not.toContain('Scan the QR')
  })
})
