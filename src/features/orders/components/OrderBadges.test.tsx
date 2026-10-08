import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DueBadge } from './OrderBadges'

const today = '2026-10-09'

describe('DueBadge', () => {
  it('flags overdue and due-today open orders', () => {
    render(<DueBadge order={{ due_date: '2026-10-08', status: 'new' }} today={today} />)
    expect(screen.getByText('Overdue')).toBeTruthy()
  })

  it('shows "Due today"', () => {
    render(<DueBadge order={{ due_date: today, status: 'ready' }} today={today} />)
    expect(screen.getByText('Due today')).toBeTruthy()
  })

  it('shows nothing for delivered/cancelled or no due date', () => {
    const { container } = render(
      <>
        <DueBadge order={{ due_date: '2026-10-01', status: 'delivered' }} today={today} />
        <DueBadge order={{ due_date: '2026-10-01', status: 'cancelled' }} today={today} />
        <DueBadge order={{ due_date: null, status: 'new' }} today={today} />
      </>,
    )
    expect(container.textContent).toBe('')
  })
})
