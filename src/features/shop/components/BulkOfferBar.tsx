import { useState } from 'react'
import { Button, Input, toast } from '../../../components/ui'
import { defaultOfferDates } from '../../../lib/offers'
import { useBulkOffer, useEndOffers } from '../hooks/useShop'

/** Shown while variants are ticked: one percent off with one date range for all of them, or end their offers. */
export function BulkOfferBar({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const defaults = defaultOfferDates()
  const [percent, setPercent] = useState('10')
  const [label, setLabel] = useState('')
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [error, setError] = useState<string | undefined>()
  const apply = useBulkOffer()
  const end = useEndOffers()

  function onApply() {
    const pct = Number(percent)
    if (!Number.isFinite(pct) || pct < 1 || pct > 90) return setError('Enter a percent from 1 to 90')
    if (to < from) return setError('The last day cannot be before the first day')
    setError(undefined)
    apply.mutate(
      { variant_ids: ids, percent_off: pct, label, starts_on: from, ends_on: to },
      {
        onSuccess: (n) => {
          toast.success(`Offer set on ${n} item${n === 1 ? '' : 's'}`)
          onDone()
        },
      },
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4" aria-label="Offer for the selected items">
      <h2 className="font-display text-lg">{ids.length} selected</h2>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Percent off" inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value)} error={error} />
        <Input label="Offer name (optional)" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
        <Input label="First day" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="Last day" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Button block disabled={apply.isPending} onClick={onApply}>
        {apply.isPending ? 'Applying…' : 'Apply offer'}
      </Button>
      <Button variant="secondary" block disabled={end.isPending} onClick={() => end.mutate(ids, { onSuccess: onDone })}>
        End their offers
      </Button>
    </section>
  )
}
