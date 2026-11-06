/** RGB in 0..1, the way Lottie stores colours. */
export type Rgb = [number, number, number]

interface Node {
  ty?: string
  c?: { k?: unknown }
  it?: Node[]
  shapes?: Node[]
  layers?: Node[]
}

/**
 * A copy of a Lottie animation with every stroke recoloured to `stroke` and every fill to `fill`.
 * Use the button's own background as `fill` so solid faces still hide what is behind them.
 */
export function recolorLottie<T>(data: T, colors: { stroke: Rgb; fill: Rgb }): T {
  const copy = structuredClone(data)
  const visit = (n: Node) => {
    if (n.ty === 'st' && n.c) n.c.k = [...colors.stroke, 1]
    if (n.ty === 'fl' && n.c) n.c.k = [...colors.fill, 1]
    for (const child of [...(n.it ?? []), ...(n.shapes ?? []), ...(n.layers ?? [])]) visit(child)
  }
  visit(copy as Node)
  return copy
}

/** "#1d4ed8" (or "#fff") to Lottie's 0..1 RGB; undefined when it is not a hex colour. */
export function hexToRgb(hex: string): Rgb | undefined {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  const h = m?.[1]
  if (!h) return undefined
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255
  return [n(0), n(2), n(4)]
}
