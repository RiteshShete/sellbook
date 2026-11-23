import { useState, type FormEvent } from 'react'
import { BottomSheet, Button, Input, toast } from '../../../components/ui'
import { formatINR, parseMoneyInput, paiseToDecimalString } from '../../../lib/money'
import { variantLabel } from '../../../lib/variants'
import { defaultOfferDates, offerState } from '../../../lib/offers'
import { useBulkOffer, useEndOffers } from '../hooks/useShop'
import type { OfferVariant } from '../schemas'

/** Set or change the offer of ONE variant: an exact offer price, a label and the inclusive dates (IST). */
export function OfferSheet({ variant, onClose }: { variant: OfferVariant; onClose: () => void }) {
  const current = offerState(variant)
  const defaults = defaultOfferDates()
  const [price, setPrice] = useState(variant.offer_price === null ? '' : paiseToDecimalString(variant.offer_price))
  const [label, setLabel] = useState(variant.offer_label ?? '')
  const [from, setFrom] = useState(current.startsOn ?? defaults.from)
  const [to, setTo] = useState(current.endsOn ?? defaults.to)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useBulkOffer()
  const end = useEndOffers()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const offer = parseMoneyInput(price)
    const found: Record<string, string> = {}
    if (offer === null || offer <= 0) found.price = 'Enter the offer price'
    else if (offer >= variant.price) found.price = `It must be below the normal price (${formatINR(variant.price)})`
    if (!from || !to) found.to = 'Choose both dates'
    else if (to < from) found.to = 'The last day cannot be before the first day'
    setErrors(found)
    if (Object.keys(found).length > 0 || offer === null) return
    save.mutate(
      { variant_ids: [variant.id], amount_off: variant.price - offer, label, starts_on: from, ends_on: to },
      {
        onSuccess: () => {
          toast.success('Offer saved')
          onClose()
        },
      },
    )
  }

  return (
    <BottomSheet open onClose={onClose} title={`${variant.products.name} · ${variantLabel(variant)}`}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <p className="text-sm text-muted">Normal price {formatINR(variant.price)}</p>
        <Input
          label="Offer price (₹)"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={errors.price}
        />
        <Input label="Offer name (optional, e.g. Diwali offer)" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="First day" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Last day" type="date" value={to} onChange={(e) => setTo(e.target.value)} error={errors.to} />
        </div>
        <p className="text-sm text-muted">The offer runs through the whole last day (India time).</p>
        <Button type="submit" block disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save offer'}
        </Button>
        {current.status !== 'none' && (
          <Button
            variant="ghost"
            className="text-danger"
            disabled={end.isPending}
            onClick={() => end.mutate([variant.id], { onSuccess: onClose })}
          >
            End this offer
          </Button>
        )}
      </form>
    </BottomSheet>
  )
}
