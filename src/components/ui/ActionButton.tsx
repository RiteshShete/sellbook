import type { LucideIcon } from 'lucide-react'
import { ACTION_STYLES, type ActionKind } from '../../lib/actionStyles'
import { Button, type ButtonProps } from './Button'

export interface ActionButtonProps extends Omit<ButtonProps, 'variant'> {
  kind: ActionKind
  /** Override the kind's icon (e.g. a trash can for "Move to Trash", still in the cancel style). */
  icon?: LucideIcon
}

/** An order action (Mark ready, Delivered, Mark paid, Back, Cancel): style and icon from one map. */
export function ActionButton({ kind, icon, children, ...rest }: ActionButtonProps) {
  const Icon = icon ?? ACTION_STYLES[kind].Icon
  return (
    <Button variant={kind} {...rest}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {children}
    </Button>
  )
}
