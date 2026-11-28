import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MoneyPage } from './MoneyPage'

// The two bodies are tested on their own; here only the switch between them matters.
vi.mock('../settings/ProfileMenu', () => ({ ProfileMenu: () => null }))
vi.mock('./PendingPage', () => ({ PendingBody: () => <p>pending body</p> }))
vi.mock('./AnalyticsPage', () => ({
  AnalyticsReports: ({ tabs }: { tabs: ReactNode }) => (
    <div>
      {tabs}
      <p>reports body</p>
    </div>
  ),
}))

const at = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <MoneyPage />
    </MemoryRouter>,
  )

afterEach(cleanup)

describe('MoneyPage', () => {
  it('opens on Pending, the view to act on', () => {
    at('/analytics')
    expect(screen.getByText('pending body')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Pending' }).getAttribute('aria-checked')).toBe('true')
  })

  it('shows Reports for ?view=reports, with the same switch on top', () => {
    at('/analytics?view=reports')
    expect(screen.getByText('reports body')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Reports' }).getAttribute('aria-checked')).toBe('true')
  })

  it('switches between the two views from the tabs', () => {
    at('/analytics')
    fireEvent.click(screen.getByRole('radio', { name: 'Reports' }))
    expect(screen.getByText('reports body')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Pending' }))
    expect(screen.getByText('pending body')).toBeTruthy()
  })
})
