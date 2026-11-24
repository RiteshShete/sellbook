import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthContext, type AuthContextValue } from '../../auth/authContext'
import { catalog } from '../store.fixtures'
import type { StoreProduct } from '../types'
import { StoreProductCard } from './StoreProductCard'

afterEach(cleanup)

// the card only builds a public picture address from the client; no network is touched
const client = {
  storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://files.test/${path}` } }) }) },
} as unknown as SupabaseClient
const auth: AuthContextValue = {
  status: 'signedOut', session: null as Session | null, client,
  signIn: async () => {}, signOut: async () => {}, signUp: async () => {}, resetPassword: async () => {}, updatePassword: async () => {},
}

function card(p: StoreProduct) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <ul>
          <StoreProductCard slug="a-foods" product={p} />
        </ul>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
const [chakli, ladoo, soldOut] = catalog().products as [StoreProduct, StoreProduct, StoreProduct]

describe('StoreProductCard', () => {
  it('links to the product page and shows the "from" price with the normal price struck through on an offer', () => {
    card(chakli)
    expect(screen.getByRole('link').getAttribute('href')).toBe(`/a-foods/products/${chakli.id}`)
    expect(screen.getByText(/from ₹120/)).toBeTruthy()
    expect(screen.getByText('₹150').tagName).toBe('S')
    expect(screen.getByText(/Diwali offer/)).toBeTruthy()
  })

  it('shows no offer line or struck price for a normal product', () => {
    card(ladoo)
    expect(screen.getByText(/from ₹100/)).toBeTruthy()
    expect(screen.queryByText(/offer/i)).toBeNull()
  })

  it('marks a sold-out product', () => {
    card(soldOut)
    expect(screen.getByText('Sold out')).toBeTruthy()
  })

  it('uses the small picture, loaded lazily, with empty alt (the name is next to it)', () => {
    card({ ...chakli, image_paths: ['owner/p/prod/abc.webp'] })
    const img = document.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://files.test/owner/p/prod/abc_t.webp')
    expect(img?.getAttribute('loading')).toBe('lazy')
    expect(img?.getAttribute('alt')).toBe('')
  })

  it('has a text alternative for the veg mark', () => {
    card(chakli)
    expect(screen.getByText('Vegetarian')).toBeTruthy()
  })

  it('adds a single-variant product with one tap, and offers no button when there is a choice or it is sold out', () => {
    const single = { ...ladoo, variants: [ladoo.variants[0] as StoreProduct['variants'][number]] }
    card(single)
    fireEvent.click(screen.getByRole('button', { name: /Add .* to cart/ }))
    expect(window.localStorage.getItem('sb:cart:a-foods')).toContain(single.variants[0]?.id)
    cleanup()
    card({ ...ladoo, variants: [...ladoo.variants, { ...(ladoo.variants[0] as StoreProduct['variants'][number]), id: '00000000-0000-4000-8000-0000000000ff' }] })
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()
    card(soldOut)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
