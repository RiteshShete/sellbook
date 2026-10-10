import { describe, expect, it } from 'vitest'
import { compareNames, formatPhone, pluralize } from './format'

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

describe('compareNames', () => {
  it('sorts Marathi names in Marathi alphabetical order, not by code unit', () => {
    const names = ['राजगिरा पीठ', 'उपवास भाजणी', 'कण्हेरी', 'वडे पीठ']
    expect([...names].sort(compareNames)).toEqual([
      'उपवास भाजणी',
      'कण्हेरी',
      'राजगिरा पीठ',
      'वडे पीठ',
    ])
  })

  it('ignores case and sorts numbers naturally for Latin names', () => {
    expect(['modak', 'Bhajani', 'Pack 10', 'Pack 9'].sort(compareNames)).toEqual([
      'Bhajani',
      'modak',
      'Pack 9',
      'Pack 10',
    ])
  })
})
