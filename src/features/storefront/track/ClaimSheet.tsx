import { useState } from 'react'
import { BottomSheet, Button, Input } from '../../../components/ui'
import { t } from '../i18n'
import { cleanUtr, utrProblem } from './utr'

/** "I have paid": the bank reference (UTR) is optional but, when given, must be 12 digits. */
export function ClaimSheet({ open, busy, onClose, onSend }: { open: boolean; busy: boolean; onClose: () => void; onSend: (utr: string) => void }) {
  const [utr, setUtr] = useState('')
  const [error, setError] = useState(false)
  return (
    <BottomSheet open={open} onClose={onClose} title={t('pay.sheetTitle')}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (utrProblem(utr)) return setError(true)
          onSend(cleanUtr(utr))
        }}
      >
        <Input
          label={t('pay.utr')}
          inputMode="numeric"
          autoComplete="off"
          value={utr}
          onChange={(e) => {
            setUtr(cleanUtr(e.target.value))
            setError(false)
          }}
          error={error ? t('pay.utrError') : undefined}
        />
        <p className="text-sm text-muted">{t('pay.utrHelp')}</p>
        <Button type="submit" block disabled={busy}>
          {busy ? t('pay.sending') : t('pay.send')}
        </Button>
      </form>
    </BottomSheet>
  )
}
