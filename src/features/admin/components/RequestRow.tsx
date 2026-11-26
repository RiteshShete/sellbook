import { useState } from 'react'
import { Button, ConfirmDialog, Input, Modal } from '../../../components/ui'
import { formatDate, formatDateTime } from '../../../lib/dates'
import { formatINR } from '../../../lib/money'
import { TIER_LABEL } from '../../plan/schemas'
import type { AdminRequest } from '../adminApi'
import { useDecideRequest } from '../useAdmin'

/** One payment claim. Approve asks once more (it switches a plan on); Reject needs a reason for the shop. */
export function RequestRow({ request: r, highlight }: { request: AdminRequest; highlight: boolean }) {
  const decide = useDecideRequest()
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const who = r.shop_name || r.email
  const close = () => setDialog(null)

  return (
    <li className={`rounded-2xl border bg-surface p-4 ${highlight ? 'border-text' : 'border-border'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate font-medium">{who}</p>
        <p className="shrink-0 font-semibold tabular-nums">
          {TIER_LABEL[r.tier]} · {formatINR(r.amount_paise)}
        </p>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">Email</dt>
        <dd className="break-all">{r.email}</dd>
        <dt className="text-muted">Reference</dt>
        <dd>{r.ref_code}</dd>
        <dt className="text-muted">UTR</dt>
        <dd className="break-all">{r.utr ?? 'not given'}</dd>
        <dt className="text-muted">Asked</dt>
        <dd>{formatDateTime(r.created_at)}</dd>
        <dt className="text-muted">Now on</dt>
        <dd>
          {r.current_tier ? TIER_LABEL[r.current_tier] : 'no plan'}
          {r.current_ends_at ? `, until ${formatDate(r.current_ends_at)}` : ''}
        </dd>
        {r.reject_reason && (
          <>
            <dt className="text-muted">Reason</dt>
            <dd>{r.reject_reason}</dd>
          </>
        )}
      </dl>
      {r.status === 'pending' && (
        <div className="mt-3 flex gap-2">
          <Button block onClick={() => setDialog('approve')}>
            Approve
          </Button>
          <Button block variant="secondary" onClick={() => setDialog('reject')}>
            Reject
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={dialog === 'approve'}
        title={`Approve ${TIER_LABEL[r.tier]} for ${who}?`}
        message={`Only approve after you have seen ${formatINR(r.amount_paise)} arrive with reference ${r.ref_code}. The plan switches on at once.`}
        confirmLabel="Approve"
        busy={decide.isPending}
        onCancel={close}
        onConfirm={() => decide.mutate({ id: r.id, approve: true, reason: '' }, { onSettled: close })}
      />
      <Modal open={dialog === 'reject'} onClose={close} title="Reject this payment?">
        <div className="flex flex-col gap-3">
          <Input
            label="Reason (the shop will see it)"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. No payment found with this reference"
          />
          <Button
            block
            disabled={reason.trim() === '' || decide.isPending}
            onClick={() =>
              decide.mutate({ id: r.id, approve: false, reason: reason.trim() }, { onSettled: close })
            }
          >
            {decide.isPending ? 'Rejecting…' : 'Reject'}
          </Button>
        </div>
      </Modal>
    </li>
  )
}
