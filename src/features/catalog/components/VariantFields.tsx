import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react'
import { useId } from 'react'
import { Input, Select, Switch } from '../../../components/ui'
import { INPUT_UNITS } from '../../../lib/measure'
import { VARIANT_NAME_SUGGESTIONS } from '../../../lib/variants'
import type { VariantDraft, VariantErrors } from '../schemas'

/** Amounts are stored in g / ml / pcs; kg and L are typed here and converted on save. */
const UNIT_OPTIONS = INPUT_UNITS.map((u) => ({ value: u, label: u }))

const iconBtn =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted active:bg-surface-2 disabled:opacity-40'

export interface VariantFieldsProps {
  variant: VariantDraft
  errors?: VariantErrors
  isFirst: boolean
  isLast: boolean
  onChange: (patch: Partial<VariantDraft>) => void
  onRemove: () => void
  onDuplicate: () => void
  onMove: (by: -1 | 1) => void
}

export function VariantFields({
  variant,
  errors,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
}: VariantFieldsProps) {
  const listId = useId()
  const what = variant.name || 'variant'
  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3">
      <Input
        label="Name (optional)"
        placeholder="e.g. Retail, Wholesale"
        list={listId}
        value={variant.name}
        onChange={(e) => onChange({ name: e.target.value })}
        error={errors?.name}
      />
      <datalist id={listId}>
        {VARIANT_NAME_SUGGESTIONS.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Input
          label="Size"
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
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Selling price (₹)"
          inputMode="decimal"
          placeholder="0"
          value={variant.price}
          onChange={(e) => onChange({ price: e.target.value })}
          error={errors?.price}
        />
        <Input
          label="Cost price (₹, optional)"
          inputMode="decimal"
          placeholder="—"
          value={variant.cost}
          onChange={(e) => onChange({ cost: e.target.value })}
          error={errors?.cost}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Switch
          label={variant.is_active ? 'Active' : 'Hidden when taking orders'}
          checked={variant.is_active}
          onChange={(is_active) => onChange({ is_active })}
        />
        <div className="ml-auto flex">
          <button
            type="button"
            className={iconBtn}
            disabled={isFirst}
            onClick={() => onMove(-1)}
            aria-label={`Move ${what} up`}
          >
            <ArrowUp className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={iconBtn}
            disabled={isLast}
            onClick={() => onMove(1)}
            aria-label={`Move ${what} down`}
          >
            <ArrowDown className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={iconBtn}
            onClick={onDuplicate}
            aria-label={`Duplicate ${what}`}
          >
            <Copy className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={`${iconBtn} text-danger`}
            onClick={onRemove}
            aria-label={`Remove ${what}`}
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </fieldset>
  )
}
