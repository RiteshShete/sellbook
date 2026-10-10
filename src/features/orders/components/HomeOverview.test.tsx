import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomeOverview } from './HomeOverview'

vi.mock('../hooks/useOrders', () => ({
  useOrders: (tab: string) => ({ data: tab === 'new' ? [1, 2, 3] : [1] }),
}))
vi.mock('../../analytics/hooks/useAnalytics', () => ({
  usePendingPayments: () => ({ data: [{ total: 30000 }, { total: 30000 }] }),
}))

afterEach(cleanup)

describe('HomeOverview', () => {
  it('uses one name, "To prepare", and links every card (no dead taps)', () => {
    render(
      <MemoryRouter>
        <HomeOverview />
      </MemoryRouter>,
    )
    expect(screen.queryByText('To make')).toBeNull()
    const prepare = screen.getByRole('link', { name: /To prepare/ })
    expect(prepare.getAttribute('href')).toBe('/?view=prep')
    expect(screen.getByRole('link', { name: /To deliver/ }).getAttribute('href')).toBe('/delivery')
    expect(screen.getByRole('link', { name: /Unpaid/ }).getAttribute('href')).toBe('/pending')
  })

  it('says what each number counts, and sums only the pending (delivered, unpaid) orders', () => {
    render(
      <MemoryRouter>
        <HomeOverview />
      </MemoryRouter>,
    )
    expect(screen.getByText('new orders')).toBeTruthy()
    expect(screen.getByText('ready orders')).toBeTruthy()
    expect(screen.getByText('delivered orders')).toBeTruthy()
    expect(screen.getByText('₹600')).toBeTruthy()
  })
})
