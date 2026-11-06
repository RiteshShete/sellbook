import type { ReactNode } from 'react'
import { BADGE_OUTLINE_STYLES, BADGE_STYLES, type BadgeKind } from '../../lib/actionStyles'

/**
 * Pill label (docs/DESIGN.md badge-pill). Colours come from the one status map in
 * lib/actionStyles.ts; the label text, not the colour, carries the meaning. `outline` is the
 * transparent bordered look used on the Home order cards.
 */
export function Badge({
  kind = 'neutral',
  outline = false,
  children,
}: {
  kind?: BadgeKind
  outline?: boolean
  children: ReactNode
}) {
  const look = outline ? `border ${BADGE_OUTLINE_STYLES[kind]}` : BADGE_STYLES[kind]
  return (
    <span
      className={`inline-flex items-center rounded-full py-0.5 text-[13px] font-medium ${outline ? 'px-2' : 'px-3'} ${look}`}
    >
      {children}
    </span>
  )
}
