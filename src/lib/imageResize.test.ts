import { describe, expect, it } from 'vitest'
import { encodeUnderCap, fileExtension, fitWithin, resizeImage, thumbPath } from './imageResize'

const blobOf = (bytes: number) => new Blob([new Uint8Array(bytes)])

describe('fitWithin', () => {
  it('scales the longest side down to the edge', () => {
    expect(fitWithin(4000, 3000, 1000)).toEqual({ width: 1000, height: 750 })
    expect(fitWithin(3000, 4000, 400)).toEqual({ width: 300, height: 400 })
  })
  it('never makes a small picture bigger', () => {
    expect(fitWithin(300, 200, 1000)).toEqual({ width: 300, height: 200 })
  })
  it('never goes below one pixel', () => {
    expect(fitWithin(5000, 1, 100)).toEqual({ width: 100, height: 1 })
  })
})

describe('encodeUnderCap', () => {
  it('returns the first quality that fits, trying high quality first', async () => {
    const tried: number[] = []
    const blob = await encodeUnderCap(async (q) => {
      tried.push(q)
      return blobOf(q > 0.6 ? 500_000 : 100_000)
    }, 300_000)
    expect(blob.size).toBe(100_000)
    expect(tried).toEqual([0.82, 0.7, 0.6])
  })

  it('stops at the first quality when the picture is already small', async () => {
    const tried: number[] = []
    await encodeUnderCap(async (q) => (tried.push(q), blobOf(50_000)), 300_000)
    expect(tried).toEqual([0.82])
  })

  it('gives up with a clear message when even the lowest quality is over the cap', async () => {
    await expect(encodeUnderCap(async () => blobOf(900_000), 300_000)).rejects.toThrow(/too detailed/)
  })
})

describe('thumbPath and fileExtension', () => {
  it('puts _t before the extension', () => {
    expect(thumbPath('abc/p/xyz/1234.webp')).toBe('abc/p/xyz/1234_t.webp')
    expect(thumbPath('abc/p/xyz/1234.jpg')).toBe('abc/p/xyz/1234_t.jpg')
  })
  it('uses jpg unless the picture is webp', () => {
    expect(fileExtension('image/webp')).toBe('webp')
    expect(fileExtension('image/jpeg')).toBe('jpg')
    expect(fileExtension('image/png')).toBe('jpg')
  })
})

describe('resizeImage input checks', () => {
  it('refuses a file that is not a picture', async () => {
    await expect(resizeImage(new File(['x'], 'a.txt', { type: 'text/plain' }), { edge: 100, cap: 1000 })).rejects.toThrow('Please choose a photo.')
  })
  it('refuses an absurdly large file before decoding it', async () => {
    const big = new File([new Uint8Array(26 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })
    await expect(resizeImage(big, { edge: 100, cap: 1000 })).rejects.toThrow(/too large/)
  })
})
