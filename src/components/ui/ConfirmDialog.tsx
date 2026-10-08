import { Button } from './Button'
import { Modal } from './Modal'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="mb-4 text-muted">{message}</p>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          className="flex-1"
          onClick={onConfirm}
          disabled={busy}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
