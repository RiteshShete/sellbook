import { useState } from 'react'
import { todayIST } from '../../../lib/dates'
import { uuid } from '../../../lib/id'
import type { Paise } from '../../../lib/money'
import { toNationalPhone } from '../../../lib/phone'
import { MAX_QTY, type LineDraft, type OrderDraft, type OrderErrors } from '../schemas'

export interface PickedVariant {
  variant_id: string
  product_name: string
  variant_name: string
  unit_price: Paise
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
    /** Adds one; merges into an existing line only if it has the same variant AND price. */
    addVariant: (v: PickedVariant) =>
      setLines((lines) => {
        const same = lines.find(
          (l) => l.variant_id === v.variant_id && l.unit_price === v.unit_price,
        )
        if (same) {
          return lines.map((l) =>
            l === same ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + 1) } : l,
          )
        }
        return [...lines, { key: uuid(), ...v, quantity: 1 }]
      }),
    setQuantity: (key: string, quantity: number) =>
      setLines((lines) => lines.map((l) => (l.key === key ? { ...l, quantity } : l))),
    removeLine: (key: string) => setLines((lines) => lines.filter((l) => l.key !== key)),
  }
}

export type OrderDraftState = ReturnType<typeof useOrderDraft>
