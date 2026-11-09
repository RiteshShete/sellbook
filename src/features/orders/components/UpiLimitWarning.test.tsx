import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { UPI_LIMIT_PAISE } from '../../../lib/upi'
import { UpiLimitWarning } from './UpiLimitWarning'

afterEach(cleanup)

describe('UpiLimitWarning', () => {
  it('is silent at or below Rs 1,00,000', () => {
    render(<UpiLimitWarning total={UPI_LIMIT_PAISE} />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('warns, without blocking, above Rs 1,00,000', () => {
    render(<UpiLimitWarning total={UPI_LIMIT_PAISE + 1} />)
    expect(screen.getByRole('status').textContent).toMatch(/above ₹1,00,000/)
  })
})
