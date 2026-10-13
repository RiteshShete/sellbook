import type { ReactNode } from 'react'

/**
 * Shows a bill like a printed receipt: a dark printer slot with the paper sliding out of it
 * (zigzag torn edge, soft shadow). `playKey` replays the animation, e.g. when a new revision is made.
 */
export function ReceiptPrinter({ playKey, children }: { playKey: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl bg-surface-2 px-3 pt-4 pb-6">
      {/* The vent. z-10 keeps it above the paper so the paper looks like it comes from inside. */}
      <div
        aria-hidden="true"
        className="relative z-10 h-5 rounded-full bg-primary shadow-[inset_0_-3px_0_0_var(--primary-active)]"
      />
      <div className="mx-4 -mt-2.5 overflow-hidden">
        <div key={playKey} className="receipt-paper receipt-edge">
          {children}
        </div>
      </div>
    </div>
  )
}
