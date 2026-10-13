import { Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatINR } from '../../../lib/money'
import type { Product } from '../schemas'

/** Lowest selling price over the variants that can be sold ("from ₹60"), or null when none. */
export function fromPrice(p: Product): number | null {
  const prices = p.variants.filter((v) => v.is_active).map((v) => v.price)
  return prices.length > 0 ? Math.min(...prices) : null
}

export interface ProductCardProps {
  product: Product
  /** Quantity already in the order: shows a badge (and the stepper, when given). */
  quantity?: number
  /** Card opens a page (Products screen)... */
  to?: string
  /** ...or runs an action (New order). */
  onSelect?: () => void
  /** One-variant products show − / + on the card once they are in the order. */
  stepper?: { onMinus: () => void; onPlus: () => void }
  extra?: ReactNode
}

const body = 'flex min-h-24 w-full min-w-0 flex-col gap-1 p-3 text-left'

/**
 * Product tile for the 2-column grid, shared by Products and New order. Name wraps to two lines
 * (long Marathi names), the price line says "from" when variants differ.
 */
export function ProductCard({
  product: p,
  quantity = 0,
  to,
  onSelect,
  stepper,
  extra,
}: ProductCardProps) {
  const price = fromPrice(p)
  const inner = (
    <>
      <span className="font-display line-clamp-2 pr-8 text-lg leading-snug break-words">
        {p.name}
      </span>
      <span className="text-sm text-muted">
        {price === null ? 'No active variants' : `from ${formatINR(price)}`}
      </span>
      {extra}
      {quantity > 0 && (
        <span
          className="absolute top-2 right-2 min-w-7 rounded-full bg-primary px-2 text-center text-sm leading-7 font-semibold text-primary-fg tabular-nums"
          aria-label={`${quantity} in this order`}
        >
          {quantity}
        </span>
      )}
    </>
  )
  return (
    <li
      className={`relative flex flex-col overflow-hidden rounded-2xl border bg-surface ${quantity > 0 ? 'border-text' : 'border-border'} ${p.is_active ? '' : 'opacity-70'}`}
    >
      {to ? (
        <Link to={to} className={body}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onSelect} className={`${body} active:bg-surface-2`}>
          {inner}
        </button>
      )}
      {stepper && quantity > 0 && (
        <div className="flex items-center justify-between border-t border-border px-2 py-1">
          <button
            type="button"
            aria-label={`One less ${p.name}`}
            onClick={stepper.onMinus}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl active:bg-surface-2"
          >
            <Minus className="h-5 w-5" />
          </button>
          <span className="font-semibold tabular-nums" aria-hidden="true">
            {quantity}
          </span>
          <button
            type="button"
            aria-label={`One more ${p.name}`}
            onClick={stepper.onPlus}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl active:bg-surface-2"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      )}
    </li>
  )
}
