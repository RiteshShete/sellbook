import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { RESERVED_SLUGS } from '../../lib/slug'
import { StorefrontLayout } from './StorefrontLayout'

afterEach(cleanup)

function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/:slug/*" element={<StorefrontLayout />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('route resolution', () => {
  it.each(['login', 'admin', 'orders', 'pricing', 'create-shop', 'account'])('the reserved word "%s" is never a shop', (slug) => {
    expect(RESERVED_SLUGS).toContain(slug)
    at(`/${slug}/products`)
    expect(screen.getByRole('heading', { name: 'Shop not found' })).toBeTruthy()
  })
})
