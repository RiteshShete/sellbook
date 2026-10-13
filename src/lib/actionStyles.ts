import { Ban, IndianRupee, PackageCheck, Truck, Undo2, type LucideIcon } from 'lucide-react'

/**
 * THE map from an action / status to its look. No screen picks its own colours for these:
 * order detail, order cards, Delivery cards, sheets and badges all read from here. Colours are
 * theme tokens from src/index.css (docs/DESIGN.md + the info/success/danger steps added in
 * docs/UI_AUDIT.md); every pair is checked by scripts/contrast.mjs.
 *
 *   ready      blue   (info)       Mark ready
 *   delivered  green  (success)    Mark delivered / Delivered
 *   paid       teal   (brand-teal) Mark paid
 *   back       neutral outline     Back to new / Back to ready / Restore
 *   cancel     red outline         Cancel order, Move to Trash (always behind a confirmation)
 * Primary saves (Add order, Save) keep the design file's primary button and are not in this map.
 */
export type ActionKind = 'ready' | 'delivered' | 'paid' | 'back' | 'cancel'

export interface ActionStyle {
  /** Tailwind classes: background, text, border and pressed state. */
  className: string
  /** Every action has an icon next to its label (colour is never the only cue). */
  Icon: LucideIcon
}

export const ACTION_STYLES: Record<ActionKind, ActionStyle> = {
  ready: { className: 'bg-info text-white active:opacity-90', Icon: PackageCheck },
  delivered: { className: 'bg-success text-white active:opacity-90', Icon: Truck },
  paid: { className: 'bg-teal text-white active:opacity-90', Icon: IndianRupee },
  back: {
    className: 'border border-border-strong bg-surface text-text active:bg-surface-2',
    Icon: Undo2,
  },
  cancel: {
    className: 'border border-danger-ink bg-surface text-danger-ink active:bg-danger-soft',
    Icon: Ban,
  },
}

/** Which action style a status move uses (mirrors StatusMove in features/orders/pipeline.ts). */
export function actionKindForMove(move: {
  kind: 'forward' | 'back' | 'cancel' | 'restore'
  to: string
}): ActionKind {
  if (move.kind === 'cancel') return 'cancel'
  if (move.kind === 'back' || move.kind === 'restore') return 'back'
  return move.to === 'delivered' ? 'delivered' : 'ready'
}

export type BadgeKind =
  | 'neutral'
  | 'info'
  | 'new'
  | 'ready'
  | 'delivered'
  | 'cancelled'
  | 'paid'
  | 'notPaid'
  | 'dueToday'
  | 'overdue'

/**
 * Status badges. Each carries its text label too. Ready is blue and Due today is amber (they were
 * both yellow before); Overdue is a solid deep red so it never reads as the soft red Not paid.
 */
export const BADGE_STYLES: Record<BadgeKind, string> = {
  neutral: 'bg-surface-2 text-text',
  info: 'bg-info-soft text-info-ink',
  new: 'bg-lavender text-text',
  ready: 'bg-info-soft text-info-ink',
  delivered: 'bg-success-soft text-success-ink',
  cancelled: 'bg-surface-strong text-text',
  paid: 'bg-teal text-white',
  notPaid: 'bg-danger-soft text-danger-ink',
  dueToday: 'bg-ochre text-text',
  overdue: 'bg-danger-deep text-white',
}
