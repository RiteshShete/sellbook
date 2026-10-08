import { useState } from 'react'
import { uuid } from '../../../lib/id'
import type { ProductDraft, ProductErrors, VariantDraft } from '../schemas'

const blankVariant = (): VariantDraft => ({
  key: uuid(),
  name: '',
  price: '',
  cost: '',
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
    setActive: (is_active: boolean) => setDraft((d) => ({ ...d, is_active })),
    addVariant: () => setDraft((d) => ({ ...d, variants: [...d.variants, blankVariant()] })),
    updateVariant: (key: string, patch: Partial<VariantDraft>) =>
      setDraft((d) => ({
        ...d,
        variants: d.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)),
      })),
    removeVariant: (key: string) =>
      setDraft((d) => ({ ...d, variants: d.variants.filter((v) => v.key !== key) })),
  }
}
