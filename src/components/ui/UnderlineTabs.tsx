import type { SegmentedOption } from './SegmentedControl'

export interface UnderlineTabsProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}

/** Two or more equal-width tabs with a 2px underline: ink when active, light grey otherwise. */
export function UnderlineTabs<T extends string>({
  options,
  value,
  onChange,
  label,
}: UnderlineTabsProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full min-w-0">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-12 min-w-0 flex-1 truncate border-b-2 px-2 py-3 text-base font-bold ${active ? 'border-text text-text' : 'border-tab-line text-muted'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
