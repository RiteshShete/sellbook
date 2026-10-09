import { Trash2 } from 'lucide-react'
import { Input, Select, Switch } from '../../../components/ui'
import { INPUT_UNITS } from '../../../lib/measure'
import type { VariantDraft, VariantErrors } from '../schemas'

/** Used for the prep list and kg totals; amounts are stored in g / ml / pcs. */
const UNIT_OPTIONS = INPUT_UNITS.map((u) => ({ value: u, label: u }))

export interface VariantFieldsProps {
  variant: VariantDraft
  errors?: VariantErrors
  onChange: (patch: Partial<VariantDraft>) => void
  onRemove: () => void
}

export function VariantFields({ variant, errors, onChange, onRemove }: VariantFieldsProps) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input
            label="Variant"
            placeholder="e.g. 500 g, Chocolate"
            value={variant.name}
            onChange={(e) => onChange({ name: e.target.value })}
            error={errors?.name}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${variant.name || 'variant'}`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-danger"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Price (₹)"
          inputMode="decimal"
          placeholder="0"
          value={variant.price}
          onChange={(e) => onChange({ price: e.target.value })}
          error={errors?.price}
        />
        <Input
          label="Cost (₹, optional)"
          inputMode="decimal"
          placeholder="—"
          value={variant.cost}
          onChange={(e) => onChange({ cost: e.target.value })}
          error={errors?.cost}
        />
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Input
          label="Size per unit (optional)"
          inputMode="decimal"
          placeholder="e.g. 500, 1.25"
          value={variant.sizeText}
          onChange={(e) => onChange({ sizeText: e.target.value })}
          error={errors?.size}
        />
        <Select
          label="Unit"
          value={variant.sizeUnit}
          options={UNIT_OPTIONS}
          onChange={(e) => {
            const unit = INPUT_UNITS.find((u) => u === e.target.value)
            if (unit) onChange({ sizeUnit: unit })
          }}
        />
      </div>
      <Switch
        label={variant.is_active ? 'Shown when taking orders' : 'Hidden when taking orders'}
        checked={variant.is_active}
        onChange={(is_active) => onChange({ is_active })}
      />
    </fieldset>
  )
}
