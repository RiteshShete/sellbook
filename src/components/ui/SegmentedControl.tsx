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
      className="flex w-full min-w-0 gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1"
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
            className={`min-h-11 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium ${active ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
