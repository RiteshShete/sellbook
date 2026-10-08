import { Minus, Plus, X } from 'lucide-react'
import { formatINR, multiplyMoney } from '../../../lib/money'
import { MAX_QTY, type LineDraft } from '../schemas'

const stepBtn =
  'inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface disabled:opacity-40'

export interface LineItemsProps {
  lines: LineDraft[]
  onQuantity: (key: string, qty: number) => void
  onRemove: (key: string) => void
}

export function LineItems({ lines, onQuantity, onRemove }: LineItemsProps) {
  if (lines.length === 0) {
    return <p className="text-sm text-muted">No items yet. Tap a variant above to add it.</p>
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {lines.map((l) => (
        <li key={l.key} className="flex flex-col gap-2 p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {l.product_name} · {l.variant_name}
              </p>
              <p className="text-sm text-muted">{formatINR(l.unit_price)} each</p>
            </div>
            <button
              type="button"
              aria-label={`Remove ${l.product_name} ${l.variant_name}`}
              onClick={() => onRemove(l.key)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="One less"
              className={stepBtn}
              disabled={l.quantity <= 1}
              onClick={() => onQuantity(l.key, l.quantity - 1)}
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              aria-label={`Quantity of ${l.product_name} ${l.variant_name}`}
              inputMode="numeric"
              className="h-11 w-16 rounded-xl border border-border bg-surface text-center"
              value={Number.isNaN(l.quantity) ? '' : String(l.quantity)}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '')
                onQuantity(l.key, digits === '' ? Number.NaN : Math.min(MAX_QTY, Number(digits)))
              }}
            />
            <button
              type="button"
              aria-label="One more"
              className={stepBtn}
              disabled={l.quantity >= MAX_QTY}
              onClick={() => onQuantity(l.key, l.quantity + 1)}
            >
              <Plus className="h-4 w-4" />
            </button>
            <span className="ml-auto font-medium">
              {Number.isSafeInteger(l.quantity)
                ? formatINR(multiplyMoney(l.unit_price, l.quantity))
                : '—'}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
