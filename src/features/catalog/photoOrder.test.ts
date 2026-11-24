import { describe, expect, it } from 'vitest'
import { movePhoto } from './photoOrder'

describe('movePhoto', () => {
  it('moves one place earlier or later', () => {
    expect(movePhoto(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(movePhoto(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
  })
  it('stays put at the ends and for a bad index, and never changes the input', () => {
    const list = ['a', 'b']
    expect(movePhoto(list, 0, -1)).toEqual(['a', 'b'])
    expect(movePhoto(list, 1, 1)).toEqual(['a', 'b'])
    expect(movePhoto(list, 5, -1)).toEqual(['a', 'b'])
    expect(list).toEqual(['a', 'b'])
  })
})
