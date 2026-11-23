import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { catalog, V_CHAKLI } from '../store.fixtures'
import type { StoreVariant } from '../types'
import { VariantPicker } from './VariantPicker'

afterEach(cleanup)

const small: StoreVariant = { ...(catalog().products[0]?.variants[0] as StoreVariant), id: '77777777-7777-4777-8777-777777777771', name: 'Small', price: 10000, effective_price: 10000, offer_price: null, offer_label: null, offer_ends_at: null }
const large: StoreVariant = { ...small, id: '77777777-7777-4777-8777-777777777772', name: 'Large', price: 15000, effective_price: 12000, offer_price: 12000, offer_label: 'Diwali offer' }

function Harness() {
  const [value, setValue] = useState<string | null>(null)
  return (
    <>
      <VariantPicker variants={[small, large]} value={value} onChange={setValue} />
      <output data-testid="chosen">{value ?? 'none'}</output>
    </>
  )
}

describe('VariantPicker', () => {
  it('lists each option with the price the customer pays', () => {
    render(<Harness />)
    expect(screen.getByRole('radio', { name: /Small/ })).toBeTruthy()
    expect(screen.getByText('₹100')).toBeTruthy()
    expect(screen.getByText('₹120')).toBeTruthy()
  })

  it('shows the normal price struck through when an offer is on, and only then', () => {
    render(<Harness />)
    expect(screen.getByText('₹150').tagName).toBe('S')
    expect(screen.queryByText('₹100', { selector: 's' })).toBeNull()
  })

  it('is a radio group with a legend, and choosing reports the variant id', () => {
    render(<Harness />)
    expect(screen.getByRole('group', { name: 'Choose an option' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /Large/ }))
    expect(screen.getByTestId('chosen').textContent).toBe(large.id)
    expect((screen.getByRole('radio', { name: /Large/ }) as HTMLInputElement).checked).toBe(true)
    expect(V_CHAKLI).toBeTruthy()
  })
})
