import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

/** docs/DESIGN.md: button-primary / button-secondary / button-text-link. */
const styles: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-fg active:bg-primary-active disabled:bg-primary-disabled disabled:text-muted',
  secondary: 'bg-surface text-text border border-border active:bg-surface-2 disabled:opacity-50',
  danger: 'bg-danger text-white active:opacity-90 disabled:opacity-50',
  ghost: 'bg-transparent text-text active:bg-surface-2 disabled:opacity-40',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  block?: boolean
}

export function Button({
  variant = 'primary',
  block = false,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors ${styles[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  )
}
