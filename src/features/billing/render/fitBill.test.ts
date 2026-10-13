import { describe, expect, it } from 'vitest'
import { MAX_BILL_BYTES } from '../schemas'
import { fitBill, ratiosFor } from './fitBill'

const blobOf = (bytes: number) => new Blob([new Uint8Array(bytes)])

describe('ratiosFor', () => {
  it('keeps every ratio for a normal bill', () => {
    expect(ratiosFor(540, 1500)).toEqual([2, 1.5, 1.25, 1, 0.75])
  })
  it('drops the sharpest ratios for a very tall bill so the canvas stays safe', () => {
    // 540 x 5000 CSS px: ratio 2 = 1080 x 10000 = 10.8M (ok); 7000 px tall = 15.1M (too big).
    expect(ratiosFor(540, 5000)[0]).toBe(2)
    expect(ratiosFor(540, 7000)[0]).toBe(1.5)
  })
  it('always leaves at least the smallest ratio', () => {
    expect(ratiosFor(540, 100_000)).toEqual([0.75])
  })
})

describe('fitBill', () => {
  it('limit is 500 KB', () => {
    expect(MAX_BILL_BYTES).toBe(500 * 1024)
  })

  it('keeps the sharpest ratio when it already fits', async () => {
    const asked: number[] = []
    const blob = await fitBill((r) => {
      asked.push(r)
      return Promise.resolve(blobOf(100_000))
    })
    expect(blob.size).toBe(100_000)
    expect(asked).toEqual([2])
  })

  it('steps down until the PNG is within the limit', async () => {
    const sizeAt: Record<number, number> = { 2: 900_000, 1.5: 600_000, 1.25: 480_000, 1: 300_000 }
    const asked: number[] = []
    const blob = await fitBill((r) => {
      asked.push(r)
      return Promise.resolve(blobOf(sizeAt[r] ?? 0))
    })
    expect(asked).toEqual([2, 1.5, 1.25])
    expect(blob.size).toBe(480_000)
    expect(blob.size).toBeLessThanOrEqual(MAX_BILL_BYTES)
  })

  it('accepts exactly the limit and rejects one byte over', async () => {
    await expect(fitBill(() => Promise.resolve(blobOf(MAX_BILL_BYTES)))).resolves.toBeDefined()
    await expect(fitBill(() => Promise.resolve(blobOf(MAX_BILL_BYTES + 1)), [1])).rejects.toThrow(
      /too large/,
    )
  })

  it('never returns an oversized image: errors when even the smallest is too big', async () => {
    await expect(fitBill(() => Promise.resolve(blobOf(2_000_000)))).rejects.toThrow(
      /too large to save \(over 500 KB\)/,
    )
  })

  it('retries a blank first pass at the same ratio', async () => {
    let calls = 0
    const blob = await fitBill(() => {
      calls += 1
      return Promise.resolve(calls === 1 ? blobOf(10) : blobOf(50_000))
    })
    expect(calls).toBe(2)
    expect(blob.size).toBe(50_000)
  })

  it('fails when the image stays blank', async () => {
    await expect(fitBill(() => Promise.resolve(null))).rejects.toThrow(/Could not draw/)
  })
})
