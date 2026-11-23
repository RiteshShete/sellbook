import { useState } from 'react'
import { BottomSheet, Button, Textarea } from '../../../components/ui'

/** Confirm a customer order, with an optional note the customer can read. */
export function ConfirmSheet({ open, busy, onClose, onConfirm }: { open: boolean; busy: boolean; onClose: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState('')
  return (
    <BottomSheet open={open} onClose={onClose} title="Confirm this order">
      <div className="flex flex-col gap-3">
        <Textarea label="Note for the customer (optional)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        <Button block disabled={busy} onClick={() => onConfirm(note)}>
          {busy ? 'Confirming…' : 'Confirm order'}
        </Button>
        <Button variant="secondary" block onClick={onClose}>
          Not now
        </Button>
      </div>
    </BottomSheet>
  )
}
