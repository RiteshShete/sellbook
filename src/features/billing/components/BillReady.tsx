import { AlertTriangle, MessageCircle, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Button, ConfirmDialog, Modal, Skeleton } from '../../../components/ui'
import type { OrderWithItems } from '../../orders/schemas'
import type { Settings } from '../../settings/schemas'
import { useBillImage } from '../hooks/useBills'
import { useShareBill } from '../hooks/useShareBill'
import { billShareText, type BillState, billFileName, formatBillNo, isOutdated } from '../schemas'
import { BillRevisions } from './BillRevisions'
import { formatDateTime } from '../../../lib/dates'
import { toWaMeLink } from '../../../lib/phone'

interface Props {
  order: OrderWithItems
  settings: Settings
  state: BillState
  regenerating: boolean
  onRegenerate: () => void
}

export function BillReady({ order, settings, state, regenerating, onRegenerate }: Props) {
  // BillCard renders this only when at least one revision exists.
  const latest = state.bills[0]
  const image = useBillImage(latest?.image_path ?? null)
  const share = useShareBill()
  const [zoom, setZoom] = useState(false)
  const [confirmOld, setConfirmOld] = useState(false)
  const [revisionsOpen, setRevisionsOpen] = useState(false)
  if (!latest) return null

  const outdated = isOutdated(state)
  // The prefix the bill was printed with (B6), not today's Settings value.
  const prefix = order.bill_prefix ?? settings.bill_prefix
  const billNo = formatBillNo(prefix, latest.bill_no)
  const fileName = billFileName(prefix, latest.bill_no)
  const text = billShareText(order, settings, billNo, latest.total_at_generation)
  const wa = order.customer_phone ? toWaMeLink(order.customer_phone, text) : null

  const doShare = () => {
    if (image.blob) share({ blob: image.blob, fileName, title: `Bill ${billNo}`, text })
  }

  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Bill {billNo}</h2>
        <span className="text-sm text-muted">
          Rev {latest.revision} · {formatDateTime(latest.generated_at)}
        </span>
      </div>

      {outdated && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-ochre p-3 text-sm text-text"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Outdated: items, discount or total changed after this bill was made.</span>
        </div>
      )}

      <button
        type="button"
        className="overflow-hidden rounded-xl border border-border"
        onClick={() => setZoom(true)}
        aria-label="View bill"
        disabled={!image.url}
      >
        {image.url ? (
          <img
            src={image.url}
            alt={`Bill ${billNo}`}
            className="max-h-72 w-full object-cover object-top"
          />
        ) : image.error ? (
          <p className="p-4 text-sm text-danger">{image.error.message}</p>
        ) : (
          <Skeleton className="h-72 w-full" />
        )}
      </button>

      {outdated && (
        <Button block disabled={regenerating} onClick={onRegenerate}>
          {regenerating ? 'Making bill…' : 'Regenerate bill'}
        </Button>
      )}
      <Button
        block
        variant={outdated ? 'secondary' : 'primary'}
        disabled={!image.blob || regenerating}
        onClick={() => (outdated ? setConfirmOld(true) : doShare())}
      >
        <Share2 className="h-5 w-5" /> Share bill
      </Button>
      <div className="flex flex-wrap gap-2">
        {wa && !outdated && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 font-medium text-text"
          >
            <MessageCircle className="h-5 w-5" /> Send payment message
          </a>
        )}
        <Button variant="ghost" className="ml-auto" onClick={() => setRevisionsOpen(true)}>
          Revisions ({state.bills.length})
        </Button>
      </div>

      <Modal open={zoom} onClose={() => setZoom(false)} title={`Bill ${billNo}`}>
        {image.url && <img src={image.url} alt={`Bill ${billNo}`} className="w-full" />}
      </Modal>
      <ConfirmDialog
        open={confirmOld}
        title="Share the outdated bill?"
        message={`It shows the old amount. Regenerate first to share the current order.`}
        confirmLabel="Share anyway"
        onCancel={() => setConfirmOld(false)}
        onConfirm={() => {
          setConfirmOld(false)
          doShare() // still inside the tap, so the share sheet is allowed
        }}
      />
      <BillRevisions
        open={revisionsOpen}
        onClose={() => setRevisionsOpen(false)}
        bills={state.bills}
        billNo={billNo}
        fileName={fileName}
      />
    </>
  )
}
