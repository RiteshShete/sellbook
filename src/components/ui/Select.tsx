import { useId, type SelectHTMLAttributes } from 'react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string
  options: SelectOption[]
  error?: string
}

export function Select({ label, options, error, className = '', id, ...rest }: SelectProps) {
  const auto = useId()
  const selectId = id ?? auto
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-muted">
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={`min-h-11 w-full min-w-0 rounded-xl border bg-surface px-3 text-text outline-none focus:border-primary ${error ? 'border-danger' : 'border-border'} ${className}`}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}
