import type { ReactNode } from 'react'
import { BADGE_STYLES, type BadgeKind } from '../../lib/actionStyles'

/**
 * Pill label (docs/DESIGN.md badge-pill). Colours come from the one status map in
 * lib/actionStyles.ts; the label text, not the colour, carries the meaning.
 */
export function Badge({ kind = 'neutral', children }: { kind?: BadgeKind; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-0.5 text-[13px] font-medium ${BADGE_STYLES[kind]}`}
    >
      {children}
    </span>
  )
}
