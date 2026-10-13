export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}

/** Pill tabs (docs/DESIGN.md category-tab): active = cream card + ink, inactive = muted. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex w-full min-w-0 flex-wrap gap-1 rounded-3xl border border-border-strong bg-surface p-1"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-11 flex-1 rounded-full px-4 text-sm font-medium whitespace-nowrap ${active ? 'bg-surface-strong text-text' : 'text-muted'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
