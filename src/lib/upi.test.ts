import { describe, expect, it } from 'vitest'
import { billMessage, upiPayLink } from './upi'

describe('upiPayLink', () => {
  it('builds an encoded upi://pay link with the amount in rupees', () => {
    expect(
      upiPayLink({
        upiId: 'shop@okicici',
        payeeName: 'Asha Cakes',
        amount: 125050,
        note: 'Bill INV-0007',
      }),
    ).toBe('upi://pay?pa=shop%40okicici&pn=Asha%20Cakes&am=1250.50&cu=INR&tn=Bill%20INV-0007')
  })
})

describe('billMessage', () => {
  const base = {
    customerName: 'Ravi',
    shopName: 'Asha Cakes',
    billNo: 'INV-0007',
    totalText: '₹500',
  }
  it('includes the UPI link when there is one', () => {
    const m = billMessage({ ...base, upiLink: 'upi://pay?pa=x' })
    expect(m).toContain('bill INV-0007 from Asha Cakes')
    expect(m).toContain('Amount: ₹500')
    expect(m).toContain('Pay by UPI: upi://pay?pa=x')
  })
  it('falls back to the QR without a UPI id', () => {
    expect(billMessage({ ...base, upiLink: null })).toContain('Scan the QR on the bill to pay.')
  })
})
