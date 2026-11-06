import { describe, expect, it } from 'vitest'
import { hexToRgb, recolorLottie } from './lottieColors'

describe('hexToRgb', () => {
  it('reads 6 and 3 digit hex', () => {
    expect(hexToRgb('#ffffff')).toEqual([1, 1, 1])
    expect(hexToRgb('#000')).toEqual([0, 0, 0])
    expect(hexToRgb(' #1d4ed8 ')?.[0]).toBeCloseTo(29 / 255)
  })
  it('rejects anything else', () => {
    expect(hexToRgb('blue')).toBeUndefined()
    expect(hexToRgb('')).toBeUndefined()
  })
})

describe('recolorLottie', () => {
  const data = {
    layers: [
      {
        shapes: [
          {
            ty: 'gr',
            it: [
              { ty: 'st', c: { k: [0, 0.7, 1, 1] } },
              { ty: 'fl', c: { k: [1, 1, 1, 1] } },
            ],
          },
        ],
      },
    ],
  }

  it('recolors strokes and fills inside groups, without touching the original', () => {
    const out = recolorLottie(data, { stroke: [1, 1, 1], fill: [0.1, 0.2, 0.3] })
    const items = out.layers[0]?.shapes[0]?.it
    expect(items?.[0]?.c?.k).toEqual([1, 1, 1, 1])
    expect(items?.[1]?.c?.k).toEqual([0.1, 0.2, 0.3, 1])
    expect(data.layers[0]?.shapes[0]?.it[0]?.c?.k).toEqual([0, 0.7, 1, 1])
  })
})
