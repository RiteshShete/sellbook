import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DueChips } from './DueChips'

afterEach(cleanup)

describe('DueChips', () => {
  it('offers Today, Tomorrow and In 2 days, counted in India time', () => {
    const onPick = vi.fn()
    render(<DueChips value="" orderDate="2026-10-31" onPick={onPick} today="2026-10-31" />)
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }))
    fireEvent.click(screen.getByRole('button', { name: 'In 2 days' }))
    expect(onPick.mock.calls.map((c) => c[0])).toEqual(['2026-10-31', '2026-11-01', '2026-11-02'])
  })

  it('marks the chosen one pressed and hides dates before the order date', () => {
    render(
      <DueChips value="2026-11-01" orderDate="2026-11-01" onPick={() => {}} today="2026-10-31" />,
    )
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Tomorrow' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: 'In 2 days' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })
})
