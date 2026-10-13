import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useOrderDraft } from './useOrderDraft'

const cake = { variant_id: 'v1', product_name: 'Cake', variant_name: '1 kg', unit_price: 48000 }

describe('useOrderDraft', () => {
  it('starts on today (IST) with no lines', () => {
    const { result } = renderHook(() => useOrderDraft())
    expect(result.current.draft.lines).toEqual([])
    expect(result.current.draft.order_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('merges the same variant+price into one line, but not a different price', () => {
    const { result } = renderHook(() => useOrderDraft())
    act(() => result.current.addVariant(cake))
    act(() => result.current.addVariant(cake))
    expect(result.current.draft.lines).toHaveLength(1)
    expect(result.current.draft.lines[0]?.quantity).toBe(2)

    act(() => result.current.addVariant({ ...cake, unit_price: 50000 }))
    expect(result.current.draft.lines).toHaveLength(2)
  })

  it('sets a variant quantity directly: adds, changes, and removes at 0', () => {
    const { result } = renderHook(() => useOrderDraft())
    act(() => result.current.setVariantQty(cake, 3))
    expect(result.current.draft.lines.map((l) => l.quantity)).toEqual([3])
    act(() => result.current.setVariantQty(cake, 7))
    expect(result.current.draft.lines.map((l) => l.quantity)).toEqual([7])
    act(() => result.current.setVariantQty(cake, 0))
    expect(result.current.draft.lines).toEqual([])
    act(() => result.current.setVariantQty(cake, 0))
    expect(result.current.draft.lines).toEqual([])
  })

  it('adds several at once from the variant sheet', () => {
    const { result } = renderHook(() => useOrderDraft())
    act(() => result.current.addVariant(cake, 4))
    act(() => result.current.addVariant(cake, 2))
    expect(result.current.draft.lines[0]?.quantity).toBe(6)
  })

  it('fills name and the 10-digit phone from a suggestion', () => {
    const { result } = renderHook(() => useOrderDraft())
    act(() => result.current.pickCustomer('Asha', '919876543210'))
    expect(result.current.draft.customer_name).toBe('Asha')
    expect(result.current.draft.customer_phone).toBe('9876543210')
  })
})
