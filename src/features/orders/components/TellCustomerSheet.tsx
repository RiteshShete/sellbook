import { MessageCircle } from 'lucide-react'
import { BottomSheet, Button } from '../../../components/ui'

export interface TellState {
  title: string
  /** wa.me link with the sentence filled in; null when the order has no valid mobile number. */
  link: string | null
  note?: string
}

/** After a decision: one tap opens WhatsApp with the sentence ready, or skip. The app never sends anything itself. */
export function TellCustomerSheet({ state, onClose }: { state: TellState | null; onClose: () => void }) {
  if (!state) return null
  return (
    <BottomSheet open onClose={onClose} title={state.title}>
      <div className="flex flex-col gap-3">
        {state.note && (
          <p role="status" className="rounded-xl bg-info-soft p-3 text-sm text-info-ink">
            {state.note}
          </p>
        )}
        {state.link ? (
          <a
            href={state.link}
            target="_blank"
            rel="noreferrer"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-fg"
          >
            <MessageCircle className="h-5 w-5" aria-hidden /> Tell the customer on WhatsApp
          </a>
        ) : (
          <p className="text-sm text-muted">This order has no valid mobile number, so there is no WhatsApp link.</p>
        )}
        <Button variant="secondary" block onClick={onClose}>
          Skip
        </Button>
      </div>
    </BottomSheet>
  )
}
