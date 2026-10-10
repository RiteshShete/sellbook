import { useState } from 'react'
import { uuid } from '../../../lib/id'
import type { ProductDraft, ProductErrors, VariantDraft } from '../schemas'

const blankVariant = (): VariantDraft => ({
  key: uuid(),
  name: '',
  price: '',
  cost: '',
  sizeText: '',
  sizeUnit: 'g',
  is_active: true,
})

/** Local editor state for one product; nothing is saved until the form submits. */
export function useProductDraft(initial?: ProductDraft) {
  const [draft, setDraft] = useState<ProductDraft>(
    () => initial ?? { name: '', is_active: true, variants: [blankVariant()] },
  )
  const [errors, setErrors] = useState<ProductErrors>({ byVariant: {} })

  return {
    draft,
    errors,
    setErrors,
    setName: (name: string) => setDraft((d) => ({ ...d, name })),
    setCategory: (category_id: string | null) => setDraft((d) => ({ ...d, category_id })),
    setActive: (is_active: boolean) => setDraft((d) => ({ ...d, is_active })),
    addVariant: () => setDraft((d) => ({ ...d, variants: [...d.variants, blankVariant()] })),
    updateVariant: (key: string, patch: Partial<VariantDraft>) =>
      setDraft((d) => ({
        ...d,
        variants: d.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)),
      })),
    /** Copies a variant (without its id, so it saves as a new one) right below the original. */
    duplicateVariant: (key: string) =>
      setDraft((d) => {
        const i = d.variants.findIndex((v) => v.key === key)
        const src = d.variants[i]
        if (!src) return d
        const copy: VariantDraft = { ...src, key: uuid() }
        delete copy.id
        return { ...d, variants: d.variants.toSpliced(i + 1, 0, copy) }
      }),
    moveVariant: (key: string, by: -1 | 1) =>
      setDraft((d) => {
        const i = d.variants.findIndex((v) => v.key === key)
        const j = i + by
        const a = d.variants[i]
        const b = d.variants[j]
        if (!a || !b) return d
        return { ...d, variants: d.variants.with(i, b).with(j, a) }
      }),
    removeVariant: (key: string) =>
      setDraft((d) => ({ ...d, variants: d.variants.filter((v) => v.key !== key) })),
  }
}
