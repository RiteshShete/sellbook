import type { ButtonHTMLAttributes } from 'react'
import { ACTION_STYLES, type ActionKind } from '../../lib/actionStyles'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'lime' | ActionKind

/** docs/DESIGN.md: button-primary / button-secondary / button-text-link. */
const styles: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-fg active:bg-primary-active disabled:bg-primary-disabled disabled:text-disabled-fg',
  secondary: 'bg-surface text-text border border-border active:bg-surface-2 disabled:opacity-50',
  danger: 'bg-danger text-white active:opacity-90 disabled:opacity-50',
  ghost: 'bg-transparent text-text active:bg-surface-2 disabled:opacity-40',
  // Login screen call-to-action on the photo background.
  lime: 'bg-lime text-textactive:bg-lime-active disabled:opacity-60',
  // Action kinds (ready / delivered / paid / back / cancel): see lib/actionStyles.ts.
  ready: `${ACTION_STYLES.ready.className} disabled:opacity-50`,
  delivered: `${ACTION_STYLES.delivered.className} disabled:opacity-50`,
  paid: `${ACTION_STYLES.paid.className} disabled:opacity-50`,
  back: `${ACTION_STYLES.back.className} disabled:opacity-50`,
  cancel: `${ACTION_STYLES.cancel.className} disabled:opacity-50`,
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
