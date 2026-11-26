import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProGate } from './ProGate'

const state = vi.hoisted(() => ({ pro: null as boolean | null }))
vi.mock('../hooks/usePlan', () => ({ usePro: () => state.pro }))

afterEach(cleanup)

const show = () =>
  render(
    <MemoryRouter>
      <ProGate feature="Order history">
        <p>secret content</p>
      </ProGate>
    </MemoryRouter>,
  )

describe('ProGate', () => {
  it('shows the content on Pro', () => {
    state.pro = true
    show()
    expect(screen.getByText('secret content')).toBeTruthy()
  })

  it('shows an upgrade message with a link to the plan page on other plans', () => {
    state.pro = false
    show()
    expect(screen.queryByText('secret content')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Order history is a Pro feature' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'See plans' }).getAttribute('href')).toBe('/plan')
  })

  it('shows neither while the plan is loading', () => {
    state.pro = null
    show()
    expect(screen.queryByText('secret content')).toBeNull()
    expect(screen.queryByText(/Pro feature/)).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
