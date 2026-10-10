import { useState } from 'react'
import { todayIST } from '../../../lib/dates'
import { uuid } from '../../../lib/id'
import type { SizeUnit } from '../../../lib/measure'
import type { Paise } from '../../../lib/money'
import { toNationalPhone } from '../../../lib/phone'
import { MAX_QTY, type LineDraft, type OrderDraft, type OrderErrors } from '../schemas'

export interface PickedVariant {
  variant_id: string
  product_name: string
  variant_name: string
  unit_price: Paise
  size_amount?: number | null
  size_unit?: SizeUnit | null
}

type TextField = Exclude<keyof OrderDraft, 'lines'>

const emptyDraft = (): OrderDraft => ({
  customer_name: '',
  customer_phone: '',
  order_date: todayIST(),
  due_date: '',
  notes: '',
  discount: '',
  lines: [],
})

/** Local order-form state; nothing is saved until submit. */
export function useOrderDraft(initial?: OrderDraft) {
  const [draft, setDraft] = useState<OrderDraft>(() => initial ?? emptyDraft())
  const [errors, setErrors] = useState<OrderErrors>({})

  const setLines = (fn: (lines: LineDraft[]) => LineDraft[]) =>
    setDraft((d) => ({ ...d, lines: fn(d.lines) }))

  return {
    draft,
    errors,
    setErrors,
    setField: (key: TextField, value: string) => setDraft((d) => ({ ...d, [key]: value })),
    pickCustomer: (name: string, phone: string | null) =>
      setDraft((d) => ({
        ...d,
        customer_name: name,
        customer_phone: phone ? toNationalPhone(phone) : '',
      })),
    /** Adds `qty` (default 1); merges into an existing line only if it has the same variant AND price. */
    addVariant: (v: PickedVariant, qty = 1) =>
      setLines((lines) => {
        const same = lines.find(
          (l) => l.variant_id === v.variant_id && l.unit_price === v.unit_price,
        )
        if (same) {
          return lines.map((l) =>
            l === same ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + qty) } : l,
          )
        }
        return [...lines, { key: uuid(), ...v, quantity: Math.min(MAX_QTY, qty) }]
      }),
    /** Sets the quantity of the line for this variant+price (adds it, or removes it at 0). */
    setVariantQty: (v: PickedVariant, qty: number) =>
      setLines((lines) => {
        const same = lines.find(
          (l) => l.variant_id === v.variant_id && l.unit_price === v.unit_price,
        )
        const q = Math.min(MAX_QTY, Math.max(0, qty))
        if (!same) return q === 0 ? lines : [...lines, { key: uuid(), ...v, quantity: q }]
        return q === 0
          ? lines.filter((l) => l !== same)
          : lines.map((l) => (l === same ? { ...l, quantity: q } : l))
      }),
    setQuantity: (key: string, quantity: number) =>
      setLines((lines) => lines.map((l) => (l.key === key ? { ...l, quantity } : l))),
    removeLine: (key: string) => setLines((lines) => lines.filter((l) => l.key !== key)),
  }
}

export type OrderDraftState = ReturnType<typeof useOrderDraft>
