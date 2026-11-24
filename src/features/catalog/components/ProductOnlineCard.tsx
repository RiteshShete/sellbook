import { useState, type FormEvent } from 'react'
import { Button, ErrorState, Input, Select, Skeleton, Switch, Textarea, toast } from '../../../components/ui'
import { useOnlineDetails, useSaveOnlineDetails } from '../../shop/hooks/useShop'
import { NUTRITION_FIELDS, parseAllergens, parseNutrition, type NutritionKey, type OnlineDetails } from '../../shop/schemas'
import { ProductPhotos } from './ProductPhotos'

function OnlineForm({ productId, d }: { productId: string; d: OnlineDetails }) {
  const [description, setDescription] = useState(d.description ?? '')
  const [ingredients, setIngredients] = useState(d.ingredients ?? '')
  const [allergens, setAllergens] = useState(d.allergens.join(', '))
  const [veg, setVeg] = useState(d.veg_type ?? '')
  const [shelf, setShelf] = useState(d.shelf_life ?? '')
  const [available, setAvailable] = useState(d.is_available)
  const [nutrition, setNutrition] = useState<Partial<Record<NutritionKey, string>>>(() =>
    Object.fromEntries(Object.entries(d.nutrition ?? {}).map(([k, v]) => [k, String(v)])),
  )
  const [nutritionError, setNutritionError] = useState<string | undefined>()
  const save = useSaveOnlineDetails(productId)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const n = parseNutrition(nutrition)
    if (!n.ok) return setNutritionError(n.error)
    setNutritionError(undefined)
    save.mutate(
      {
        description: description.trim() || null,
        ingredients: ingredients.trim() || null,
        allergens: parseAllergens(allergens),
        veg_type: veg === '' ? null : (veg as OnlineDetails['veg_type']),
        shelf_life: shelf.trim() || null,
        is_available: available,
        nutrition: n.value,
      },
      { onSuccess: () => toast.success('Online details saved') },
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <Textarea label="Description" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
      <Textarea label="Ingredients" value={ingredients} maxLength={1000} onChange={(e) => setIngredients(e.target.value)} />
      <Input label="Allergens (separate with commas)" value={allergens} onChange={(e) => setAllergens(e.target.value)} />
      <Select
        label="Veg mark"
        value={veg}
        options={[
          { value: '', label: 'Not shown' },
          { value: 'veg', label: 'Vegetarian' },
          { value: 'non_veg', label: 'Non-vegetarian' },
          { value: 'egg', label: 'Contains egg' },
        ]}
        onChange={(e) => setVeg(e.target.value)}
      />
      <Input label="Shelf life (e.g. 15 days)" value={shelf} maxLength={100} onChange={(e) => setShelf(e.target.value)} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Nutrition per 100 g (optional)</legend>
        <div className="grid grid-cols-2 gap-3">
          {NUTRITION_FIELDS.map(({ key, label }) => (
            <Input key={key} label={label} inputMode="decimal" value={nutrition[key] ?? ''} onChange={(e) => setNutrition({ ...nutrition, [key]: e.target.value })} />
          ))}
        </div>
        {nutritionError && <p role="alert" className="text-sm text-danger">{nutritionError}</p>}
      </fieldset>
      <Switch label={available ? 'Available to order' : 'Sold out for now'} checked={available} onChange={setAvailable} />
      <Button type="submit" block disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save online details'}
      </Button>
    </form>
  )
}

/** What customers see of this product besides its name and prices: pictures and details. Existing products only. */
export function ProductOnlineCard({ productId }: { productId: string }) {
  const details = useOnlineDetails(productId)
  return (
    <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4" aria-label="Online shop details">
      <h2 className="font-display text-xl">In your online shop</h2>
      {details.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : details.isError ? (
        <ErrorState error={details.error} onRetry={() => void details.refetch()} />
      ) : (
        <>
          <ProductPhotos productId={productId} paths={details.data.image_paths} />
          <OnlineForm key={details.dataUpdatedAt} productId={productId} d={details.data} />
        </>
      )}
    </section>
  )
}
