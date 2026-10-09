import type { ReactNode } from 'react'

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

/**
 * Pill labels (docs/DESIGN.md badge-pill) filled with the brand card colours. Ink text on every
 * fill keeps contrast high; the label text, not the colour, carries the meaning.
 */
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2',
  info: 'bg-lavender',
  success: 'bg-mint',
  warning: 'bg-ochre',
  danger: 'bg-coral',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-0.5 text-[13px] font-medium text-text ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
