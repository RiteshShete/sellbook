import { AlertTriangle } from 'lucide-react'
import { formatINR, type Paise } from '../../../lib/money'
import { UPI_LIMIT_PAISE } from '../../../lib/upi'

/**
 * Non-blocking heads-up under the order form: UPI apps and banks often refuse a single payment
 * above Rs 1,00,000, so the QR on this order's bill may not work for the customer.
 */
export function UpiLimitWarning({ total }: { total: Paise }) {
  if (total <= UPI_LIMIT_PAISE) return null
  return (
    <p role="status" className="flex items-start gap-2 rounded-2xl bg-ochre p-3 text-sm text-text">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        This total is above {formatINR(UPI_LIMIT_PAISE)}. Many UPI apps and banks decline a single
        payment that large, so the customer may need another way to pay.
      </span>
    </p>
  )
}
