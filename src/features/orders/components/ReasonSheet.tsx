import { useState } from 'react'
import { BottomSheet, Button, Chip, Input } from '../../../components/ui'
import { DECLINE_REASONS } from '../customerOrders'

interface Props {
  open: boolean
  title: string
  confirmLabel: string
  busy: boolean
  /** Quick reasons to tap (declining); without it the owner types the reason (payment not received). */
  quick?: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}

/** A reason is REQUIRED: for a decline the customer is told it, for "not received" it is shown on their payment page. */
export function ReasonSheet({ open, title, confirmLabel, busy, quick = false, onClose, onSubmit }: Props) {
  const [chip, setChip] = useState<string>(quick ? (DECLINE_REASONS[0]?.value ?? '') : '')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | undefined>()

  function submit() {
    const reason = [chip === 'Other' ? '' : chip, text.trim()].filter(Boolean).join(': ')
    if (!reason) return setError('Give a reason')
    setError(undefined)
    onSubmit(reason)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        {quick && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Reason">
            {DECLINE_REASONS.map((r) => (
              <Chip key={r.value} selected={chip === r.value} onClick={() => setChip(r.value)}>
                {r.label}
              </Chip>
            ))}
          </div>
        )}
        <Input
          label={quick ? 'More detail (required for Other)' : 'Reason (the customer will see this)'}
          value={text}
          maxLength={300}
          onChange={(e) => {
            setText(e.target.value)
            setError(undefined)
          }}
          error={error}
        />
        <Button block disabled={busy} onClick={submit}>
          {busy ? 'Saving…' : confirmLabel}
        </Button>
        <Button variant="secondary" block onClick={onClose}>
          Cancel
        </Button>
      </div>
    </BottomSheet>
  )
}
