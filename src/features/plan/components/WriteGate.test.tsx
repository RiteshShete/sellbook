import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WriteGate } from './WriteGate'

const state = vi.hoisted(() => ({ canWrite: true }))
vi.mock('../hooks/usePlan', () => ({ useCanWrite: () => state.canWrite }))

afterEach(cleanup)

const show = () =>
  render(
    <MemoryRouter>
      <WriteGate title="New order">
        <p>the order form</p>
      </WriteGate>
    </MemoryRouter>,
  )

describe('WriteGate', () => {
  it('shows the screen while the shop can write', () => {
    state.canWrite = true
    show()
    expect(screen.getByText('the order form')).toBeTruthy()
  })

  it('replaces the screen with a read-only message when the plan has ended', () => {
    state.canWrite = false
    show()
    expect(screen.queryByText('the order form')).toBeNull()
    expect(screen.getByRole('heading', { name: 'The shop is read-only' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'See plans' }).getAttribute('href')).toBe('/plan')
  })
})
