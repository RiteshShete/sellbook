import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { SegmentedControl } from '../../../components/ui'
import { formatINR } from '../../../lib/money'
import { orderTotals, type ShopRules } from '../../../lib/pricing'
import { variantLabel } from '../../../lib/variants'
import type { OfferVariant } from '../schemas'

/** "What customers pay": tap quantities to see the subtotal, savings, delivery and total with the current rules. */
export function Calculator({ variants, rules }: { variants: OfferVariant[]; rules: ShopRules }) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [fulfilment, setFulfilment] = useState<'delivery' | 'pickup'>('delivery')
  const lines = variants
    .filter((v) => (qty[v.id] ?? 0) > 0)
    .map((v) => ({
      variant: { price: v.price, offer_price: v.offer_price, offer_starts_at: v.offer_starts_at, offer_ends_at: v.offer_ends_at },
      qty: qty[v.id] ?? 0,
    }))
  const t = orderTotals(lines, rules, fulfilment)
  const step = (id: string, by: number) => setQty((q) => ({ ...q, [id]: Math.min(50, Math.max(0, (q[id] ?? 0) + by)) }))

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-display text-xl">What customers pay</h2>
      <SegmentedControl
        label="How the customer gets it"
        value={fulfilment}
        onChange={setFulfilment}
        options={[
          { value: 'delivery', label: 'Delivery' },
          { value: 'pickup', label: 'Pickup' },
        ]}
      />
      <ul className="divide-y divide-border">
        {variants.slice(0, 12).map((v) => (
          <li key={v.id} className="flex min-h-11 items-center gap-2 py-1">
            <span className="min-w-0 flex-1 truncate text-sm">
              {v.products.name} · {variantLabel(v)}
            </span>
            <button type="button" aria-label={`One less ${v.products.name} ${variantLabel(v)}`} className="grid h-11 w-11 place-items-center" onClick={() => step(v.id, -1)}>
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center tabular-nums">{qty[v.id] ?? 0}</span>
            <button type="button" aria-label={`One more ${v.products.name} ${variantLabel(v)}`} className="grid h-11 w-11 place-items-center" onClick={() => step(v.id, 1)}>
              <Plus className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm" aria-live="polite">
        <dt>Items</dt>
        <dd className="text-right">{formatINR(t.subtotal)}</dd>
        {t.offerSavings > 0 && (
          <>
            <dt>You save with offers</dt>
            <dd className="text-right">{formatINR(t.offerSavings)}</dd>
          </>
        )}
        <dt>Delivery</dt>
        <dd className="text-right">{t.deliveryFee === 0 ? 'Free' : formatINR(t.deliveryFee)}</dd>
        <dt className="font-medium">Customer pays</dt>
        <dd className="text-right font-medium">{formatINR(t.total)}</dd>
      </dl>
      {lines.length > 0 && t.belowMinimum && <p className="text-sm text-danger-ink">Below your minimum order: the customer could not place this.</p>}
    </section>
  )
}
