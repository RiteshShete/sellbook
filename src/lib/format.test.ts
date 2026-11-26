import { describe, expect, it } from 'vitest'
import { compareNames, formatBytes, formatPhone, pluralize } from './format'

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

describe('formatBytes', () => {
  it('uses the largest unit that keeps the number small', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(512_000)).toBe('500 KB')
    expect(formatBytes(20 * 1024 * 1024)).toBe('20 MB')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
    expect(formatBytes(1024 ** 3)).toBe('1 GB')
  })

  it('never goes negative', () => {
    expect(formatBytes(-5)).toBe('0 B')
  })
})
