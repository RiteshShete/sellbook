import { useEffect, useRef, type ReactNode } from 'react'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** 'center' = dialog, 'bottom' = bottom sheet */
  placement?: 'center' | 'bottom'
}

/**
 * Accessible overlay. Closes on Escape and backdrop tap; locks page scroll behind it (iOS drags
 * the page otherwise) and moves focus into the dialog, returning it on close.
 */
export function Modal({ open, onClose, title, children, placement = 'center' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      opener?.focus()
    }
  }, [open])

  if (!open) return null
  const bottom = placement === 'bottom'
  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/40 ${bottom ? 'items-end' : 'items-center justify-center p-4'}`}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full min-w-0 bg-surface outline-none text-text ${bottom ? 'max-h-[85dvh] overflow-y-auto rounded-t-3xl pb-[env(safe-area-inset-bottom)]' : 'max-w-sm rounded-3xl'}`}
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
