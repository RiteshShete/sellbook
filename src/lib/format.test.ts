import { describe, expect, it } from 'vitest'
import { formatPhone, pluralize } from './format'

describe('format', () => {
  it('formats phone numbers', () => {
    expect(formatPhone('9876543210')).toBe('+91 98765 43210')
    expect(formatPhone('junk')).toBe('junk')
  })
  it('pluralizes', () => {
    expect(pluralize(1, 'order')).toBe('1 order')
    expect(pluralize(3, 'order')).toBe('3 orders')
  })
})
