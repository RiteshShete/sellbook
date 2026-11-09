import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BillTemplate, type BillData } from './BillTemplate'

afterEach(cleanup)

function data(over: Partial<BillData> = {}): BillData {
  const source = {
    order_no: 12,
    customer_name: 'Ravi',
    customer_phone: null,
    total: 70000,
    discount: 0,
    items: [],
  } as unknown as BillData['source']
  return {
    source,
    billNo: 'INV-0012',
    date: '10 Oct 2026',
    shop: { name: 'Asha Cakes', address: '', phone: '', footer: null, upiId: 'shop@okicici' },
    logo: null,
    qr: 'data:image/png;base64,AAAA',
    paid: false,
    ...over,
  }
}

describe('BillTemplate payment block', () => {
  it('shows the QR with the real amount, and the UPI ID beneath', () => {
    render(<BillTemplate data={data()} />)
    expect(screen.getByText(/Scan to pay/).textContent).toContain('₹700')
    expect(screen.getByAltText('QR code to pay ₹700')).toBeTruthy()
    expect(screen.getByText('UPI: shop@okicici')).toBeTruthy()
  })

  it('shows PAID and no QR or UPI ID when the order is paid', () => {
    render(<BillTemplate data={data({ paid: true })} />)
    expect(screen.getByText(/PAID/).textContent).toContain('₹700')
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByText(/UPI:/)).toBeNull()
  })

  it('shows "Amount due" without a QR', () => {
    render(<BillTemplate data={data({ qr: null })} />)
    expect(screen.getByText(/Amount due/).textContent).toContain('₹700')
    expect(screen.queryByRole('img')).toBeNull()
  })
})
