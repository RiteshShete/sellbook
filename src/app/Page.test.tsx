import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { Page } from './Page'

function app(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <p>home screen</p>
              <Link to="/orders/1">open order</Link>
            </>
          }
        />
        <Route path="/delivery" element={<p>delivery screen</p>} />
        <Route
          path="/orders/1"
          element={
            <Page title="Order #1" back="/">
              detail
            </Page>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('Page back button', () => {
  it('goes back in history when the page was opened from another screen', () => {
    app(['/delivery', '/'])
    fireEvent.click(screen.getByText('open order'))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('home screen')).toBeTruthy()
  })

  it('falls back to its parent screen when opened directly (no history, e.g. installed app)', () => {
    app(['/orders/1'])
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('home screen')).toBeTruthy()
  })

  it('has no back button on tab screens', () => {
    render(
      <MemoryRouter>
        <Page title="Home">content</Page>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })
})
