import { Link } from 'react-router-dom'
import { Button, ErrorState, Skeleton } from '../../../components/ui'
import type { OrderWithItems } from '../../orders/schemas'
import { useSettings } from '../../settings/hooks/useSettings'
import { useBillState, useGenerateBill } from '../hooks/useBills'
import { BillReady } from './BillReady'

const card = 'flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4'

/** Bill section of the order detail: make, preview, regenerate (B7), share, revisions. */
export function BillCard({ order }: { order: OrderWithItems }) {
  const settings = useSettings()
  const state = useBillState(order.id)
  const generate = useGenerateBill(order.id)

  if (state.isPending || settings.isPending) {
    return <Skeleton className="h-28 w-full" />
  }
  if (state.isError || settings.isError) {
    const retry = () => void (state.isError ? state.refetch() : settings.refetch())
    return (
      <section className={card}>
        <ErrorState
          title="Could not load the bill"
          error={state.error ?? settings.error}
          onRetry={retry}
        />
      </section>
    )
  }

  const s = settings.data
  const make = () => generate.mutate(s)
  const busyLabel = generate.isPending ? 'Making bill…' : null

  if (state.data.bills.length === 0) {
    return (
      <section className={card}>
        <h2 className="font-semibold">Bill</h2>
        {order.items.length === 0 ? (
          <p className="text-sm text-muted">Add at least one item to make a bill.</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              No bill yet. Making one gives this order its bill number.
            </p>
            <Button block disabled={generate.isPending} onClick={make}>
              {busyLabel ?? 'Make bill'}
            </Button>
          </>
        )}
        {!s.qr_path && (
          <p className="text-sm text-muted">
            Tip: add your payment QR in{' '}
            <Link to="/settings" className="font-medium underline underline-offset-4">
              Settings
            </Link>{' '}
            so the bill shows “Scan to pay”.
          </p>
        )}
      </section>
    )
  }

  return (
    <section className={card}>
      <BillReady
        order={order}
        settings={s}
        state={state.data}
        regenerating={generate.isPending}
        onRegenerate={make}
      />
    </section>
  )
}
