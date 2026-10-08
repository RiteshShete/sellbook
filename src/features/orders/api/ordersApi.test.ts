import { describe, expect, it } from 'vitest'
import { searchFilter } from './ordersApi'

describe('searchFilter', () => {
  it('is null for blank input', () => {
    expect(searchFilter('   ')).toBeNull()
  })

  it('searches names only for short text', () => {
    expect(searchFilter('Asha')).toBe('customer_name.ilike.*Asha*')
  })

  it('adds phone digits when 3+ digits are typed', () => {
    expect(searchFilter('98765 4')).toBe(
      'customer_name.ilike.*98765 4*,customer_phone.like.*987654*',
    )
  })

  it('matches order / bill numbers for "12", "#12" and "INV-12"', () => {
    expect(searchFilter('12')).toBe('customer_name.ilike.*12*,order_no.eq.12,bill_no.eq.12')
    expect(searchFilter('#12')).toContain('order_no.eq.12')
    expect(searchFilter('INV-0012')).toContain('bill_no.eq.12')
  })

  it('strips characters that would break the or() filter', () => {
    expect(searchFilter('a,b(c)*%')).toBe('customer_name.ilike.*a b c*')
  })
})
