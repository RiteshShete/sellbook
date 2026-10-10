import type { ReactNode } from 'react'

export interface ChipProps {
  selected: boolean
  onClick: () => void
  children: ReactNode
}

/** Filter chip (docs/DESIGN.md category-tab): a toggle, so it carries aria-pressed. Wraps; never scrolls sideways. */
export function Chip({ selected, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 max-w-full rounded-full px-4 text-sm font-medium break-words ${selected ? 'bg-surface-strong text-text ring-1 ring-text' : 'border border-border-strong bg-surface text-body'}`}
    >
      {children}
    </button>
  )
}
