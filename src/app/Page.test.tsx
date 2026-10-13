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

describe('Page heading', () => {
  it('shows the title as the one h1 with a small subtitle, wrapping a long name', () => {
    render(
      <MemoryRouter>
        <Page title="सौ. सुनंदा कुलकर्णी आणि कुटुंब" subtitle="Order #15 · 10 Oct 2026" wrapTitle>
          x
        </Page>
      </MemoryRouter>,
    )
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toBe('सौ. सुनंदा कुलकर्णी आणि कुटुंब')
    expect(h1.className).toContain('line-clamp-2')
    expect(screen.getByText('Order #15 · 10 Oct 2026')).toBeTruthy()
  })
})
