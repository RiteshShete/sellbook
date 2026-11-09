import { useId, type InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  /** Light-on-photo look (login screen): white label, translucent field, error on a cream chip. */
  onImage?: boolean
}

export function Input({ label, error, onImage = false, className = '', id, ...rest }: InputProps) {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className={`text-sm font-medium ${onImage ? 'text-white' : 'text-muted'}`}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-err` : undefined}
        className={`min-h-11 w-full min-w-0 rounded-xl border px-4 text-text outline-none focus:ring-1 ${onImage ? 'bg-on-image-field focus:border-white focus:ring-white' : 'bg-surface focus:border-text focus:ring-text'} ${error ? 'border-danger' : onImage ? 'border-on-image-border' : 'border-border-strong'} ${className}`}
        {...rest}
      />
      {error && (
        <p
          id={`${inputId}-err`}
          className={`text-sm text-danger ${onImage ? 'w-fit rounded-lg bg-surface px-2 py-0.5' : ''}`}
        >
          {error}
        </p>
      )}
    </div>
  )
}
