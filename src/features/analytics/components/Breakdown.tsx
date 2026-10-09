import { useState } from 'react'
import { SegmentedControl } from '../../../components/ui'
import { formatINR, type Paise } from '../../../lib/money'
import type { MonthAnalytics } from '../schemas'

type View = 'product' | 'variant'

interface Row {
  key: string
  name: string
  units: number
  orders: number
  revenue: Paise
}

/** Per-product / per-variant table. Gross line revenue before order discounts (A7). */
export function Breakdown({ a }: { a: MonthAnalytics }) {
  const [view, setView] = useState<View>('product')
  const rows: Row[] =
    view === 'product'
      ? a.by_product
      : a.by_variant.map((v) => ({ ...v, name: `${v.product_name} · ${v.variant_name}` }))

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div>
        <h2 className="font-semibold">What sold</h2>
        <p className="text-sm text-muted">Item amounts before order discounts</p>
      </div>
      <SegmentedControl
        label="Group by"
        value={view}
        onChange={setView}
        options={[
          { value: 'product', label: 'Products' },
          { value: 'variant', label: 'Variants' },
        ]}
      />
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nothing delivered this month.</p>
      ) : (
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-1 font-medium">{view === 'product' ? 'Product' : 'Variant'}</th>
              <th className="py-1 text-right font-medium">Units</th>
              <th className="py-1 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border">
                <td className="py-2 pr-2 break-words">
                  {r.name}
                  <span className="block text-xs text-muted">
                    {r.orders} {r.orders === 1 ? 'order' : 'orders'}
                  </span>
                </td>
                <td className="py-2 text-right align-top">{r.units}</td>
                <td className="py-2 text-right align-top font-medium">{formatINR(r.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
