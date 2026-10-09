import { useState } from 'react'
import { BottomSheet, Button, Skeleton } from '../../../components/ui'
import { formatDateTime } from '../../../lib/dates'
import { formatINR } from '../../../lib/money'
import { useBillImage } from '../hooks/useBills'
import { useShareBill } from '../hooks/useShareBill'
import type { Bill } from '../schemas'

interface Props {
  open: boolean
  onClose: () => void
  bills: Bill[]
  billNo: string
  fileName: string
}

/** Every stored revision of the bill, newest first; tap one to see and share it. */
export function BillRevisions({ open, onClose, bills, billNo, fileName }: Props) {
  const [selected, setSelected] = useState<Bill | null>(null)
  return (
    <BottomSheet open={open} onClose={onClose} title={`Bill ${billNo} · revisions`}>
      {selected ? (
        <RevisionImage
          bill={selected}
          fileName={fileName}
          billNo={billNo}
          onBack={() => setSelected(null)}
        />
      ) : (
        <ul className="divide-y divide-border">
          {bills.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
                onClick={() => setSelected(b)}
              >
                <span className="flex-1">
                  Revision {b.revision}
                  <span className="block text-sm text-muted">{formatDateTime(b.generated_at)}</span>
                </span>
                <span className="font-medium">{formatINR(b.total_at_generation)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  )
}

function RevisionImage(props: {
  bill: Bill
  billNo: string
  fileName: string
  onBack: () => void
}) {
  const { bill, billNo, fileName, onBack } = props
  const image = useBillImage(bill.image_path)
  const share = useShareBill()
  return (
    <div className="flex flex-col gap-3 p-4">
      {image.error ? (
        <p role="alert" className="text-sm text-danger">
          {image.error.message}
        </p>
      ) : image.url ? (
        <img
          src={image.url}
          alt={`Bill ${billNo}, revision ${bill.revision}`}
          className="w-full rounded-lg border border-border"
        />
      ) : (
        <Skeleton className="h-96 w-full" />
      )}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button
          className="flex-1"
          disabled={!image.blob}
          // No payment message: an old revision's amount may differ from the order now.
          onClick={() =>
            image.blob && share({ blob: image.blob, fileName, title: `Bill ${billNo}` })
          }
        >
          Share revision {bill.revision}
        </Button>
      </div>
    </div>
  )
}
