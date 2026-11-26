import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../../auth/authContext'
import { EXAMPLE_SHOP } from '../contract.fixtures'
import type { CustomerOrder } from '../types'
import { PaymentPanel } from './PaymentPanel'

afterEach(cleanup)

const upi = { method: 'upi', upi_id: 'shop@upi', payee_name: 'Ritesh Foods' } as const
const order = (over: Partial<CustomerOrder> = {}): CustomerOrder =>
  ({
    id: '11111111-1111-4111-8111-111111111111', order_no: 12, total: 34000, status: 'new', confirmation_status: 'pending',
    payment_status: 'pending', payment_claim_status: 'none', claim_count: 0, payment_reject_reason: null, payment: upi,
    shop: { name: 'Ritesh Foods', slug: 'ritesh-foods', whatsapp: '919876543210' }, ...over,
  }) as unknown as CustomerOrder

function show(o: CustomerOrder, shopOverrides: Record<string, unknown> = {}) {
  const rpc = vi.fn(async (fn: string) => (fn === 'storefront_shop' ? { data: { ...EXAMPLE_SHOP, ...shopOverrides }, error: null } : { data: null, error: null }))
  const client = { rpc } as unknown as SupabaseClient
  const auth: AuthContextValue = { status: 'signedIn', session: { user: { id: 'u' } } as Session, client, signIn: async () => {}, signOut: async () => {}, signUp: async () => {}, resetPassword: async () => {}, updatePassword: async () => {} }
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <PaymentPanel order={o} slug="ritesh-foods" />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('PaymentPanel: paying by UPI', () => {
  it('shows the exact amount and a UPI link for exactly the order total (no tr or mc)', () => {
    show(order())
    expect(screen.getByText('₹340')).toBeTruthy()
    const href = screen.getByRole('link', { name: /Pay with a UPI app/ }).getAttribute('href') ?? ''
    expect(href.startsWith('upi://pay?')).toBe(true)
    expect(href).toContain('am=340.00')
    expect(href).toContain('cu=INR')
    expect(href).toContain('pn=Ritesh%20Foods')
    expect(href).toContain('tn=Order%2012%20Ritesh%20Foods')
    expect(href).not.toMatch(/[?&](tr|mc)=/)
  })

  it('always offers the manual way: copy the UPI ID and the amount, with the honest note', () => {
    show(order())
    expect(screen.getByRole('button', { name: /Copy UPI ID: shop@upi/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Copy the amount/ })).toBeTruthy()
    expect(screen.getByText(/confirmed by the shop after they see it in their account/)).toBeTruthy()
  })

  it('has no UPI app link when the payee name is missing, but the manual way stays', () => {
    show(order({ payment: { method: 'upi', upi_id: 'shop@upi', payee_name: null } }))
    expect(screen.queryByRole('link', { name: /Pay with a UPI app/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Copy UPI ID/ })).toBeTruthy()
  })

  it('"I have paid" opens a sheet whose UTR must be empty or 12 digits', () => {
    show(order())
    fireEvent.click(screen.getByRole('button', { name: 'I have paid' }))
    const utr = screen.getByLabelText(/UTR or reference number/)
    fireEvent.change(utr, { target: { value: 'ab12345' } })
    expect((utr as HTMLInputElement).value).toBe('12345')
    fireEvent.click(screen.getByRole('button', { name: 'Tell the shop' }))
    expect(screen.getByText(/A UTR has 12 digits/)).toBeTruthy()
  })
})

describe('PaymentPanel: the other states', () => {
  it('waiting: says the shop is checking and offers no second payment', () => {
    show(order({ payment_claim_status: 'claimed', claim_count: 1 }))
    expect(screen.getByText('Waiting for the shop to confirm your payment')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /I have paid/ })).toBeNull()
  })

  it('confirmed: green "Payment confirmed" with the amount', () => {
    show(order({ payment_status: 'paid', payment_claim_status: 'verified', payment: { method: 'upi', upi_id: null, payee_name: null } }))
    expect(screen.getByText('Payment confirmed')).toBeTruthy()
    expect(screen.getByText(/The shop received ₹340/)).toBeTruthy()
  })

  it('rejected: shows the shop\'s reason, lets them try again, and offers pay on delivery when the shop allows it', async () => {
    show(order({ payment_claim_status: 'rejected', claim_count: 1, payment_reject_reason: 'Not in my account' }))
    expect(screen.getByText(/Not in my account/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'I have paid, try again' })).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Pay on delivery instead' })).toBeTruthy()
  })

  it('rejected at a shop that has no pay-on-delivery: no such button', async () => {
    show(order({ payment_claim_status: 'rejected', claim_count: 1, payment_reject_reason: 'x' }), { pay_cod: false })
    await screen.findByRole('button', { name: 'I have paid, try again' })
    expect(screen.queryByRole('button', { name: 'Pay on delivery instead' })).toBeNull()
  })

  it('three claims used: no more "I have paid", message the shop instead', () => {
    show(order({ payment_claim_status: 'rejected', claim_count: 3, payment_reject_reason: 'x' }))
    expect(screen.queryByRole('button', { name: /I have paid/ })).toBeNull()
    expect(screen.getByText(/message the shop on WhatsApp about your payment/)).toBeTruthy()
  })

  it('pay on delivery: shows what to hand over; a cancelled order shows nothing', () => {
    const cod = { method: 'cod', upi_id: null, payee_name: null } as const
    show(order({ payment: cod }))
    expect(screen.getByText('Pay ₹340 when you receive your order.')).toBeTruthy()
    cleanup()
    show(order({ status: 'cancelled', confirmation_status: 'declined' }))
    expect(screen.queryByText(/Pay|Payment/)).toBeNull()
  })
})
