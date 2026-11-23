import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { OtpInput } from './OtpInput'

afterEach(cleanup)

function Harness({ onComplete }: { onComplete?: (c: string) => void }) {
  const [code, setCode] = useState('')
  return <OtpInput value={code} onChange={setCode} onComplete={onComplete} error={code === '000000' ? 'Wrong code' : undefined} />
}

const input = () => screen.getByLabelText('Code from the email') as HTMLInputElement

describe('OtpInput', () => {
  it('is a labelled numeric one-time-code field', () => {
    render(<Harness />)
    expect(input().getAttribute('inputmode')).toBe('numeric')
    expect(input().getAttribute('autocomplete')).toBe('one-time-code')
  })

  it('keeps digits only while typing', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: '12a3' } })
    expect(input().value).toBe('123')
  })

  it('takes a whole pasted code with spaces and fires onComplete once', () => {
    const done = vi.fn()
    render(<Harness onComplete={done} />)
    fireEvent.change(input(), { target: { value: '123 456' } })
    expect(input().value).toBe('123456')
    expect(done).toHaveBeenCalledTimes(1)
    expect(done).toHaveBeenCalledWith('123456')
  })

  it('does not complete on a partial paste', () => {
    const done = vi.fn()
    render(<Harness onComplete={done} />)
    fireEvent.change(input(), { target: { value: '12345' } })
    expect(done).not.toHaveBeenCalled()
  })

  it('cuts a longer paste to six digits', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: '123456789' } })
    expect(input().value).toBe('123456')
  })

  it('announces an error and marks the field invalid', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: '000000' } })
    expect(screen.getByRole('alert').textContent).toBe('Wrong code')
    expect(input().getAttribute('aria-invalid')).toBe('true')
  })
})
