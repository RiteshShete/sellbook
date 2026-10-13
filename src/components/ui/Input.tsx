import { useId, type InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', id, ...rest }: InputProps) {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-muted">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-err` : undefined}
        className={`min-h-11 w-full min-w-0 rounded-xl border bg-surface px-4 text-text outline-none focus:border-text focus:ring-1 focus:ring-text ${error ? 'border-danger' : 'border-border-strong'} ${className}`}
        {...rest}
      />
      {error && (
        <p id={`${inputId}-err`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
