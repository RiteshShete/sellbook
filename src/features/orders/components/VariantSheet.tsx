import { Minus, Plus } from 'lucide-react'
import { BottomSheet } from '../../../components/ui'
import { formatINR } from '../../../lib/money'
import { variantLabel } from '../../../lib/variants'
import type { Product, Variant } from '../../catalog/schemas'
import type { PickedVariant } from '../hooks/useOrderDraft'
import { MAX_QTY, type LineDraft } from '../schemas'

const stepBtn =
  'inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-surface disabled:opacity-40'

export const pickedFrom = (p: Product, v: Variant): PickedVariant => ({
  variant_id: v.id,
  product_name: p.name,
  variant_name: v.name,
  unit_price: v.price,
  size_amount: v.size_amount,
  size_unit: v.size_unit,
})

/** Quantity of this catalog variant already in the order (same variant at its current price). */
export const lineQty = (lines: LineDraft[], v: Variant) =>
  lines.find((l) => l.variant_id === v.id && l.unit_price === v.price)?.quantity ?? 0

export interface VariantSheetProps {
  product: Product | null
  lines: LineDraft[]
  onSetQty: (picked: PickedVariant, qty: number) => void
  onClose: () => void
}

/** Every sellable variant of one product as a row: label, price and a − qty + stepper (typeable). */
export function VariantSheet({ product, lines, onSetQty, onClose }: VariantSheetProps) {
  const variants = product?.variants.filter((v) => v.is_active) ?? []
  return (
    <BottomSheet open={product !== null} onClose={onClose} title={product?.name ?? 'Product'}>
      <ul className="flex flex-col gap-3">
        {product &&
          variants.map((v) => {
            const qty = lineQty(lines, v)
            const picked = pickedFrom(product, v)
            const label = variantLabel(v)
            return (
              <li key={v.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">{label}</p>
                  <p className="text-sm text-muted tabular-nums">{formatINR(v.price)}</p>
                </div>
                <button
                  type="button"
                  className={stepBtn}
                  aria-label={`One less ${label}`}
                  disabled={qty <= 0}
                  onClick={() => onSetQty(picked, qty - 1)}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  aria-label={`Quantity of ${label}`}
                  inputMode="numeric"
                  placeholder="0"
                  className="h-11 w-14 rounded-xl border border-border-strong bg-surface text-center"
                  value={qty === 0 ? '' : String(qty)}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '')
                    onSetQty(picked, digits === '' ? 0 : Number(digits))
                  }}
                />
                <button
                  type="button"
                  className={stepBtn}
                  aria-label={`One more ${label}`}
                  disabled={qty >= MAX_QTY}
                  onClick={() => onSetQty(picked, qty + 1)}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </li>
            )
          })}
      </ul>
    </BottomSheet>
  )
}
