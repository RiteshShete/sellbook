import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const styles: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg',
  secondary: 'bg-surface-2 text-text border border-border',
  danger: 'bg-danger text-white',
  ghost: 'bg-transparent text-primary',
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
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-4 text-base font-medium transition-opacity active:opacity-80 disabled:opacity-50 ${styles[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  )
}
