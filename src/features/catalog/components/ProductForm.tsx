import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../../app/Page'
import { Button, ConfirmDialog, Input, Select, Switch, toast } from '../../../components/ui'
import {
  useCategories,
  useSaveProduct,
  useTrashProduct,
  useTrashVariant,
} from '../hooks/useCatalog'
import { useProductDraft } from '../hooks/useProductDraft'
import { draftFromProduct, validateProductDraft, type Product, type VariantDraft } from '../schemas'
import { VariantFields } from './VariantFields'

type Pending = { kind: 'product' } | { kind: 'variant'; variant: VariantDraft } | null

export function ProductForm({ product }: { product?: Product }) {
  const navigate = useNavigate()
  const form = useProductDraft(product ? draftFromProduct(product) : undefined)
  const categories = useCategories().data?.categories ?? []
  const save = useSaveProduct()
  const trashProduct = useTrashProduct()
  const trashVariant = useTrashVariant()
  const [confirm, setConfirm] = useState<Pending>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateProductDraft(form.draft, product?.id)
    form.setErrors(result.ok ? { byVariant: {} } : result.errors)
    if (!result.ok) return
    save.mutate(result.payload, {
      onSuccess: () => {
        toast.success(product ? 'Product saved' : 'Product added')
        void navigate('/catalog')
      },
    })
  }

  function removeVariant(v: VariantDraft) {
    // Unsaved rows just disappear; saved ones go to Trash after a confirm.
    if (v.id) setConfirm({ kind: 'variant', variant: v })
    else form.removeVariant(v.key)
  }

  function onConfirm() {
    if (confirm?.kind === 'product' && product) {
      trashProduct.mutate(product.id, {
        onSuccess: () => {
          toast.success(`${product.name} moved to Trash`)
          void navigate('/catalog', { replace: true })
        },
      })
    } else if (confirm?.kind === 'variant' && confirm.variant.id) {
      const { key, id, name } = confirm.variant
      trashVariant.mutate(id, {
        onSuccess: () => {
          form.removeVariant(key)
          setConfirm(null)
          toast.success(`${name} moved to Trash`)
        },
      })
    }
  }

  return (
    <Page title={product ? 'Edit product' : 'New product'} back="/catalog">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Product name"
          value={form.draft.name}
          onChange={(e) => form.setName(e.target.value)}
          error={form.errors.name}
        />
        {categories.length > 0 && (
          <Select
            label="Category"
            value={form.draft.category_id ?? ''}
            options={[
              { value: '', label: 'Uncategorised' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            onChange={(e) => form.setCategory(e.target.value || null)}
          />
        )}
        <Switch
          label={form.draft.is_active ? 'Active' : 'Inactive (hidden when taking orders)'}
          checked={form.draft.is_active}
          onChange={form.setActive}
        />

        <h2 className="mt-2 font-semibold">Variants</h2>
        {form.errors.variants && <p className="text-sm text-danger">{form.errors.variants}</p>}
        {form.draft.variants.map((v, i, all) => (
          <VariantFields
            key={v.key}
            variant={v}
            isFirst={i === 0}
            isLast={i === all.length - 1}
            onDuplicate={() => form.duplicateVariant(v.key)}
            onMove={(by) => form.moveVariant(v.key, by)}
            errors={form.errors.byVariant[v.key]}
            onChange={(patch) => form.updateVariant(v.key, patch)}
            onRemove={() => removeVariant(v)}
          />
        ))}
        <Button variant="secondary" onClick={form.addVariant}>
          <Plus className="h-5 w-5" /> Add variant
        </Button>

        <Button type="submit" block disabled={save.isPending} className="mt-2">
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        {product && (
          <Button
            variant="ghost"
            className="text-danger"
            onClick={() => setConfirm({ kind: 'product' })}
          >
            Move product to Trash
          </Button>
        )}
      </form>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'variant' ? 'Remove variant?' : 'Move to Trash?'}
        message={
          confirm?.kind === 'variant'
            ? `"${confirm.variant.name}" goes to Trash now. Old orders keep their copy.`
            : 'The product and its variants go to Trash. You can restore them. Old orders are not changed.'
        }
        confirmLabel="Move to Trash"
        destructive
        busy={trashProduct.isPending || trashVariant.isPending}
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </Page>
  )
}
