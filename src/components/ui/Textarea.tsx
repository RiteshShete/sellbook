import { useId, type TextareaHTMLAttributes } from 'react'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({ label, error, className = '', id, rows = 3, ...rest }: TextareaProps) {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-muted">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-err` : undefined}
        className={`w-full min-w-0 rounded-xl border bg-surface px-4 py-2 text-text outline-none focus:border-text focus:ring-1 focus:ring-text ${error ? 'border-danger' : 'border-border'} ${className}`}
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
