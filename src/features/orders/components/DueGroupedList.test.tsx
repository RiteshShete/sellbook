import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OrderListRow } from '../schemas'
import { DueGroupedList } from './DueGroupedList'

const order = (id: string, no: number) =>
  ({ id, order_no: no, due_date: null, customer_name: `Cust ${no}` }) as unknown as OrderListRow

const renderItem = (o: OrderListRow) => <li key={o.id}>{o.customer_name}</li>

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('DueGroupedList leaving rows', () => {
  it('keeps a removed order for a moment (inert, hidden from screen readers), then drops it', () => {
    vi.useFakeTimers()
    const a = order('a', 1)
    const b = order('b', 2)
    const { rerender } = render(<DueGroupedList orders={[a, b]} renderItem={renderItem} />)
    rerender(<DueGroupedList orders={[b]} renderItem={renderItem} />)

    const ghost = screen.getByText('Cust 1').closest('li.row-out')
    expect(ghost?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText(/No due date · 1/)).toBeTruthy() // the count ignores the leaving row

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(screen.queryByText('Cust 1')).toBeNull()
    expect(screen.getByText('Cust 2')).toBeTruthy()
  })

  it('shows an order that comes back (Undo) as a normal row at once', () => {
    vi.useFakeTimers()
    const a = order('a', 1)
    const b = order('b', 2)
    const { rerender } = render(<DueGroupedList orders={[a, b]} renderItem={renderItem} />)
    rerender(<DueGroupedList orders={[b]} renderItem={renderItem} />)
    rerender(<DueGroupedList orders={[a, b]} renderItem={renderItem} />)
    expect(screen.getByText('Cust 1').closest('li.row-out')).toBeNull()
  })
})
