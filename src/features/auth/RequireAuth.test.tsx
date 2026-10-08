import type { SupabaseClient } from '@supabase/supabase-js'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthContext, type AuthContextValue, type AuthStatus } from './authContext'
import { RequireAuth } from './RequireAuth'

function renderAt(status: AuthStatus) {
  const value: AuthContextValue = {
    status,
    session: null,
    // The guard never touches the client; a bare stub is enough here.
    client: {} as SupabaseClient,
    signIn: async () => {},
    signOut: async () => {},
  }
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/orders']}>
        <Routes>
          <Route path="/login" element={<p>login screen</p>} />
          <Route
            path="/orders"
            element={
              <RequireAuth>
                <p>private orders</p>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RequireAuth', () => {
  it('shows a loading state, and no private content, while the session is unknown', () => {
    renderAt('loading')
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByText('private orders')).toBeNull()
  })

  it('redirects signed-out users to /login', () => {
    renderAt('signedOut')
    expect(screen.getByText('login screen')).toBeTruthy()
    expect(screen.queryByText('private orders')).toBeNull()
  })

  it('renders children for a signed-in owner', () => {
    renderAt('signedIn')
    expect(screen.getByText('private orders')).toBeTruthy()
  })
})
