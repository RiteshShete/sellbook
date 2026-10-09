import { useEffect, type ReactNode } from 'react'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** 'center' = dialog, 'bottom' = bottom sheet */
  placement?: 'center' | 'bottom'
}

/** Accessible overlay. Closes on Escape and backdrop tap. */
export function Modal({ open, onClose, title, children, placement = 'center' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const bottom = placement === 'bottom'
  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/40 ${bottom ? 'items-end' : 'items-center justify-center p-4'}`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full min-w-0 bg-surface text-text ${bottom ? 'max-h-[85dvh] overflow-y-auto rounded-t-3xl pb-[env(safe-area-inset-bottom)]' : 'max-w-sm rounded-3xl'}`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center text-2xl text-muted"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
