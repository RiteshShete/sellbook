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

  it('prints the terms line on every bill, paid or not', () => {
    render(<BillTemplate data={data({ paid: true })} />)
    expect(screen.getByText(/issues a revised bill with the same number/)).toBeTruthy()
  })

  it('shows "Amount due" without a QR', () => {
    render(<BillTemplate data={data({ qr: null })} />)
    expect(screen.getByText(/Amount due/).textContent).toContain('₹700')
    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('BillTemplate delivery charge and offers', () => {
  const item = (over: Record<string, unknown>) => ({
    id: 'i1', product_name: 'Chakli', variant_name: 'Large', quantity: 2, unit_price: 12000, line_total: 24000,
    position: 0, size_amount: null, size_unit: null, list_price: 15000, offer_label: 'Diwali offer', ...over,
  })
  const withItems = (extra: Record<string, unknown>) =>
    data({ source: { order_no: 12, customer_name: 'Ravi', customer_phone: null, total: 28000, discount: 0, items: [item({})], ...extra } as unknown as BillData['source'] })

  it('lists the subtotal and the delivery charge when there is one', () => {
    render(<BillTemplate data={withItems({ delivery_fee: 4000 })} />)
    expect(screen.getByText('Subtotal')).toBeTruthy()
    expect(screen.getByText('Delivery')).toBeTruthy()
    expect(screen.getByText('+ ₹40')).toBeTruthy()
  })

  it('has no delivery or subtotal row for a plain order', () => {
    render(<BillTemplate data={withItems({ delivery_fee: 0 })} />)
    expect(screen.queryByText('Delivery')).toBeNull()
    expect(screen.queryByText('Subtotal')).toBeNull()
  })

  it('says how much the offers saved, without changing the sum', () => {
    render(<BillTemplate data={withItems({ delivery_fee: 4000 })} />)
    expect(screen.getByText('You saved ₹60 with offers')).toBeTruthy()
  })

  it('shows no savings note for an order without offers', () => {
    render(<BillTemplate data={withItems({ items: [item({ list_price: null })] })} />)
    expect(screen.queryByText(/You saved/)).toBeNull()
  })
})
