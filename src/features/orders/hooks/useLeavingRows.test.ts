import { describe, expect, it } from 'vitest'
import { removedItems } from './useLeavingRows'

describe('removedItems', () => {
  it('returns what disappeared, keeping the old order', () => {
    const prev = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(removedItems(prev, [{ id: 'b' }])).toEqual([{ id: 'a' }, { id: 'c' }])
  })

  it('returns nothing when rows are only added or reordered', () => {
    expect(removedItems([{ id: 'a' }], [{ id: 'b' }, { id: 'a' }])).toEqual([])
  })
})
