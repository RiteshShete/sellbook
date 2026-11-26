import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from './authContext'
import { isCustomerOnly } from './myContext'
import { RequireOwner } from './RequireOwner'

afterEach(cleanup)

type Ctx = { is_owner: boolean; shop_slug: string | null; has_customer_profile: boolean }

function renderWith(rpc: () => Promise<{ data: unknown; error: unknown }>) {
  const client = { rpc: vi.fn(rpc) } as unknown as SupabaseClient
  const value: AuthContextValue = {
    status: 'signedIn',
    session: { user: { id: 'u1' } } as Session,
    client,
    signIn: async () => {},
    signOut: async () => {},
    signUp: async () => {},
    resetPassword: async () => {},
    updatePassword: async () => {},
  }
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthContext.Provider value={value}>
        <MemoryRouter>
          <RequireOwner>
            <p>owner screens</p>
          </RequireOwner>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

const as = (ctx: Ctx) => () => Promise.resolve({ data: ctx, error: null })

describe('isCustomerOnly', () => {
  it('is true only for a customer who has no shop', () => {
    expect(isCustomerOnly({ is_owner: false, shop_slug: null, has_customer_profile: true })).toBe(true)
    expect(isCustomerOnly({ is_owner: true, shop_slug: 'a-foods', has_customer_profile: true })).toBe(false)
    expect(isCustomerOnly({ is_owner: true, shop_slug: 'a-foods', has_customer_profile: false })).toBe(false)
    expect(isCustomerOnly({ is_owner: false, shop_slug: null, has_customer_profile: false })).toBe(false)
  })
})

describe('RequireOwner', () => {
  it('shows a skeleton while the role loads', () => {
    renderWith(() => new Promise(() => {}))
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy()
    expect(screen.queryByText('owner screens')).toBeNull()
  })

  it('lets a shop owner in', async () => {
    renderWith(as({ is_owner: true, shop_slug: 'a-foods', has_customer_profile: false }))
    expect(await screen.findByText('owner screens')).toBeTruthy()
  })

  it('lets in an owner who is also a customer', async () => {
    renderWith(as({ is_owner: true, shop_slug: 'a-foods', has_customer_profile: true }))
    expect(await screen.findByText('owner screens')).toBeTruthy()
  })

  it('lets in an account with neither role yet (an old self-sign-up owner)', async () => {
    renderWith(as({ is_owner: false, shop_slug: null, has_customer_profile: false }))
    expect(await screen.findByText('owner screens')).toBeTruthy()
  })

  it('keeps a customer-only account out and offers the way to create a shop or sign out', async () => {
    renderWith(as({ is_owner: false, shop_slug: null, has_customer_profile: true }))
    expect(await screen.findByText('This account has no shop')).toBeTruthy()
    expect(screen.queryByText('owner screens')).toBeNull()
    expect(screen.getByText(/create my shop/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })

  it('shows the screens when the role cannot be read (the database still refuses)', async () => {
    renderWith(() => Promise.resolve({ data: null, error: { message: 'network down', code: '' } }))
    expect(await screen.findByText('owner screens')).toBeTruthy()
  })
})
