import { useState } from 'react'
import { Input } from '../../../components/ui'
import { formatDate } from '../../../lib/dates'
import { formatPhone } from '../../../lib/format'
import { useDebouncedValue } from '../../../lib/useDebouncedValue'
import { useCustomerSuggestions } from '../hooks/useOrders'
import type { OrderDraftState } from '../hooks/useOrderDraft'

/** Name (with suggestions from past orders) + phone. */
export function CustomerFields({ form }: { form: OrderDraftState }) {
  const [open, setOpen] = useState(false)
  const term = useDebouncedValue(form.draft.customer_name)
  const suggestions = useCustomerSuggestions(open ? term : '')
  const list = open ? (suggestions.data ?? []) : []

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Input
          label="Customer name"
          autoComplete="off"
          value={form.draft.customer_name}
          onChange={(e) => {
            form.setField('customer_name', e.target.value)
            setOpen(true)
          }}
          // Delay so a tap on a suggestion lands before the list closes.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          error={form.errors.customer_name}
        />
        {list.length > 0 && (
          <ul
            role="listbox"
            aria-label="Past customers"
            className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-md"
          >
            {list.map((s) => (
              <li key={`${s.customer_phone ?? ''}|${s.customer_name}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="flex min-h-12 w-full flex-col items-start px-3 py-2 text-left"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    form.pickCustomer(s.customer_name, s.customer_phone)
                    setOpen(false)
                  }}
                >
                  <span className="font-medium">{s.customer_name}</span>
                  <span className="text-xs text-muted">
                    {s.customer_phone ? formatPhone(s.customer_phone) : 'No phone'} · last{' '}
                    {formatDate(s.last_order_date)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Input
        label="Phone (optional)"
        type="tel"
        inputMode="tel"
        placeholder="98765 43210"
        value={form.draft.customer_phone}
        onChange={(e) => form.setField('customer_phone', e.target.value)}
        error={form.errors.customer_phone}
      />
    </div>
  )
}
