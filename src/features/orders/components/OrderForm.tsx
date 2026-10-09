import type { FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../../app/Page'
import { Button, Input, Textarea, toast } from '../../../components/ui'
import { formatINR } from '../../../lib/money'
import { useCreateOrder, useUpdateOrder } from '../hooks/useOrders'
import { useOrderDraft } from '../hooks/useOrderDraft'
import { draftFromOrder, draftTotals, validateOrderDraft, type OrderWithItems } from '../schemas'
import { CustomerFields } from './CustomerFields'
import { ItemPicker } from './ItemPicker'
import { LineItems } from './LineItems'

/** New order (no `order`) or edit of an existing one. `notice` shows above the fields. */
export function OrderForm({ order, notice }: { order?: OrderWithItems; notice?: ReactNode }) {
  const navigate = useNavigate()
  const form = useOrderDraft(order ? draftFromOrder(order) : undefined)
  const create = useCreateOrder()
  const update = useUpdateOrder(order?.id ?? '')
  const busy = create.isPending || update.isPending
  const totals = draftTotals(form.draft.lines, form.draft.discount)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateOrderDraft(form.draft)
    form.setErrors(result.ok ? {} : result.errors)
    if (!result.ok) {
      toast.error('Check the highlighted fields')
      return
    }
    const done = (id: string, msg: string) => {
      toast.success(msg)
      void navigate(`/orders/${id}`, { replace: true })
    }
    if (order) {
      update.mutate(
        { p: result.payload, version: order.version_no },
        { onSuccess: (o) => done(o.id, 'Order saved') },
      )
    } else {
      create.mutate(result.payload, { onSuccess: (o) => done(o.id, `Order #${o.order_no} added`) })
    }
  }

  return (
    <Page
      title={order ? `Edit order #${order.order_no}` : 'New order'}
      back={order ? `/orders/${order.id}` : '/'}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {notice}
        <CustomerFields form={form} />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Order date"
            type="date"
            value={form.draft.order_date}
            onChange={(e) => form.setField('order_date', e.target.value)}
            error={form.errors.order_date}
          />
          <Input
            label="Due (optional)"
            type="date"
            min={form.draft.order_date}
            value={form.draft.due_date}
            onChange={(e) => form.setField('due_date', e.target.value)}
            error={form.errors.due_date}
          />
        </div>

        <h2 className="mt-2 font-semibold">Items</h2>
        <ItemPicker onPick={form.addVariant} />
        <LineItems
          lines={form.draft.lines}
          onQuantity={form.setQuantity}
          onRemove={form.removeLine}
        />
        {form.errors.lines && <p className="text-sm text-danger">{form.errors.lines}</p>}

        <Input
          label="Discount (₹, optional)"
          inputMode="decimal"
          placeholder="0"
          value={form.draft.discount}
          onChange={(e) => form.setField('discount', e.target.value)}
          error={form.errors.discount}
        />
        <Textarea
          label="Notes (optional)"
          rows={2}
          value={form.draft.notes}
          onChange={(e) => form.setField('notes', e.target.value)}
        />

        <dl className="flex flex-col gap-1 rounded-2xl bg-surface-2 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Items</dt>
            <dd>{formatINR(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Discount</dt>
              <dd>− {formatINR(totals.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatINR(totals.total)}</dd>
          </div>
        </dl>

        <Button type="submit" block disabled={busy}>
          {busy ? 'Saving…' : order ? 'Save changes' : 'Add order'}
        </Button>
      </form>
    </Page>
  )
}
