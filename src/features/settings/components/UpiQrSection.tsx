import { Badge, Skeleton, Switch } from '../../../components/ui'
import { formatINR } from '../../../lib/money'
import { buildUpiUri, isValidVpa, qrMode, upiNote, type QrMode } from '../../../lib/upi'
import { useUpiQr } from '../../../lib/useUpiQr'
import { UpiNote } from '../../billing/components/UpiNote'

/** The QR the preview shows pays this much (Rs 1.00), so testing costs one rupee. */
const TEST_AMOUNT = 100

const MODE_LABEL: Record<QrMode, string> = {
  dynamic: 'Dynamic QR on',
  uploaded: 'Using uploaded QR',
  none: 'No QR',
}
const MODE_BADGE = { dynamic: 'delivered', uploaded: 'info', none: 'neutral' } as const

interface Props {
  /** Values as currently typed in the form (not yet saved), so the preview is live. */
  upiId: string
  payeeName: string
  useDynamic: boolean
  hasUploadedQr: boolean
  onToggle: (on: boolean) => void
}

/** Which QR bills get, the "Use dynamic QR" switch, and a live Rs 1 test QR. */
export function UpiQrSection({ upiId, payeeName, useDynamic, hasUploadedQr, onToggle }: Props) {
  const vpa = upiId.trim()
  const name = payeeName.trim()
  const mode = qrMode({
    upi_id: vpa,
    payee_name: name,
    use_dynamic_qr: useDynamic,
    qr_path: hasUploadedQr ? 'uploaded' : null,
  })
  const testLink =
    mode === 'dynamic'
      ? buildUpiUri({ vpa, payeeName: name, amount: TEST_AMOUNT, note: upiNote('TEST') })
      : null
  const qr = useUpiQr(testLink)

  const missing = !isValidVpa(vpa) ? 'a valid UPI ID' : name === '' ? 'a payee name' : null

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3">
      <legend className="sr-only">Payment QR on bills</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Payment QR on bills</h3>
        <Badge kind={MODE_BADGE[mode]}>{MODE_LABEL[mode]}</Badge>
      </div>

      <Switch label="Use dynamic QR" checked={useDynamic} onChange={onToggle} />
      {useDynamic && missing && (
        <p className="text-sm text-muted">
          Add {missing} to turn the dynamic QR on
          {hasUploadedQr ? '; until then bills use your uploaded QR.' : '.'}
        </p>
      )}
      {!useDynamic && (
        <p className="text-sm text-muted">
          {hasUploadedQr
            ? 'Bills use your uploaded QR image.'
            : 'Bills show no QR, only the amount due.'}
        </p>
      )}

      {testLink && (
        <div className="flex flex-col items-center gap-2">
          {qr.data ? (
            // Always dark on white, whatever the app looks like: scanners need the contrast.
            <img
              src={qr.data}
              alt={`Test UPI QR code to pay ${formatINR(TEST_AMOUNT)} to ${vpa}`}
              className="h-44 w-44 rounded-xl border border-border bg-white"
            />
          ) : qr.isError ? (
            <p role="alert" className="text-sm text-danger">
              Could not draw the QR code.
            </p>
          ) : (
            <Skeleton className="h-44 w-44" />
          )}
          <p className="text-center text-sm">
            Test QR for {formatINR(TEST_AMOUNT)} · Scan with your own UPI app to test
          </p>
        </div>
      )}
      <UpiNote />
    </fieldset>
  )
}
