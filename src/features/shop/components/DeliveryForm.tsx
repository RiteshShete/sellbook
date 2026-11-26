import { useState, type FormEvent } from 'react'
import { Button, Input, Select, Switch } from '../../../components/ui'
import { paiseToDecimalString, parseMoneyInput, type Paise } from '../../../lib/money'
import { useUpdateShop } from '../hooks/useShop'
import type { Shop } from '../schemas'

const money = (p: Paise | null) => (p === null ? '' : paiseToDecimalString(p))

/** Delivery, minimum order, lead time, the "closed" switch and the announcement banner. */
export function DeliveryForm({ shop, onChange }: { shop: Shop; onChange: (patch: Partial<Shop>) => void }) {
  const [mode, setMode] = useState(shop.delivery_mode)
  const [fee, setFee] = useState(money(shop.delivery_fee))
  const [freeAbove, setFreeAbove] = useState(money(shop.free_delivery_above))
  const [minOrder, setMinOrder] = useState(money(shop.min_order))
  const [lead, setLead] = useState(String(shop.lead_time_hours))
  const [accepts, setAccepts] = useState(shop.accepts_orders)
  const [closed, setClosed] = useState(shop.closed_message ?? '')
  const [banner, setBanner] = useState(shop.banner_text ?? '')
  const [note, setNote] = useState(shop.delivery_note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useUpdateShop('Saved')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const found: Record<string, string> = {}
    const feeP = fee.trim() === '' ? 0 : parseMoneyInput(fee)
    const minP = minOrder.trim() === '' ? 0 : parseMoneyInput(minOrder)
    const freeP = freeAbove.trim() === '' ? null : parseMoneyInput(freeAbove)
    const hours = Number(lead)
    if (feeP === null) found.fee = 'Enter an amount'
    if (minP === null) found.min = 'Enter an amount'
    if (freeP === null && freeAbove.trim() !== '') found.free = 'Enter an amount, or leave it empty'
    if (!Number.isInteger(hours) || hours < 0 || hours > 720) found.lead = 'Whole hours, from 0 to 720'
    setErrors(found)
    if (Object.keys(found).length > 0 || feeP === null || minP === null) return
    const patch = {
      delivery_mode: mode,
      delivery_fee: feeP,
      min_order: minP,
      free_delivery_above: freeP,
      lead_time_hours: hours,
      accepts_orders: accepts,
      closed_message: closed,
      banner_text: banner,
      delivery_note: note,
    }
    save.mutate(patch, {
      onSuccess: () => {
        onChange({ delivery_mode: mode, delivery_fee: feeP, free_delivery_above: freeP, min_order: minP })
      },
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-display text-xl">Delivery and orders</h2>
      <Select
        label="Customers can"
        value={mode}
        options={[
          { value: 'both', label: 'Choose delivery or pickup' },
          { value: 'delivery', label: 'Delivery only' },
          { value: 'pickup', label: 'Pickup only' },
        ]}
        onChange={(e) => setMode(e.target.value as Shop['delivery_mode'])}
      />
      <Input label="Delivery charge (₹)" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} error={errors.fee} />
      <Input
        label="Free delivery from (₹, optional)"
        inputMode="decimal"
        value={freeAbove}
        onChange={(e) => setFreeAbove(e.target.value)}
        error={errors.free}
      />
      <Input label="Minimum order (₹)" inputMode="decimal" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} error={errors.min} />
      <Input label="Time needed before an order (hours)" inputMode="numeric" value={lead} onChange={(e) => setLead(e.target.value)} error={errors.lead} />
      <Input label="Delivery note (e.g. Within 5 km)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
      <Input label="Announcement on the shop page (optional)" value={banner} maxLength={200} onChange={(e) => setBanner(e.target.value)} />
      <Switch label={accepts ? 'Taking orders' : 'Not taking orders'} checked={accepts} onChange={setAccepts} />
      {!accepts && <Input label="Message to customers" value={closed} maxLength={200} onChange={(e) => setClosed(e.target.value)} />}
      <Button type="submit" block disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  )
}
