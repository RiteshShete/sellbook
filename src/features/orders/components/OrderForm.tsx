import type { FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../../app/Page'
import { Button, Input, Textarea, toast } from '../../../components/ui'
import { formatINR } from '../../../lib/money'
import { weightSummary } from '../../../lib/variants'
import { useCreateOrder, useUpdateOrder } from '../hooks/useOrders'
import { useOrderDraft } from '../hooks/useOrderDraft'
import {
  draftFromOrder,
  draftTotals,
  itemSize,
  validateOrderDraft,
  type OrderWithItems,
} from '../schemas'
import { CustomerFields } from './CustomerFields'
import { LineItems } from './LineItems'
import { ProductPicker } from './ProductPicker'

/** New order (no `order`) or edit of an existing one. `notice` shows above the fields. */
export function OrderForm({ order, notice }: { order?: OrderWithItems; notice?: ReactNode }) {
  const navigate = useNavigate()
  const form = useOrderDraft(order ? draftFromOrder(order) : undefined)
  const create = useCreateOrder()
  const update = useUpdateOrder(order?.id ?? '')
  const busy = create.isPending || update.isPending
  const totals = draftTotals(form.draft.lines, form.draft.discount)
  const weight = weightSummary(
    form.draft.lines.map((l) => ({ quantity: l.quantity, size: itemSize(l) })),
  )

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

        <h2 className="mt-2 font-display text-xl">Add items</h2>
        <ProductPicker form={form} />

        <h2 className="mt-2 flex items-baseline justify-between gap-2 font-display text-xl">
          In this order
          {weight.text && (
            <span className="text-base font-normal text-muted tabular-nums">{weight.text}</span>
          )}
        </h2>
        <LineItems
          lines={form.draft.lines}
          onQuantity={form.setQuantity}
          onRemove={form.removeLine}
        />
        {weight.note && form.draft.lines.length > 0 && (
          <p className="-mt-2 text-sm text-muted">{weight.note}</p>
        )}
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

        {totals.discount > 0 && (
          <dl className="flex flex-col gap-1 rounded-2xl bg-surface-2 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Items</dt>
              <dd className="tabular-nums">{formatINR(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Discount</dt>
              <dd className="tabular-nums">− {formatINR(totals.discount)}</dd>
            </div>
          </dl>
        )}

        {/* Sticky: always visible above the tab bar, so Add order is one tap from anywhere in the form. */}
        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] -mx-4 flex items-center gap-3 border-t border-border bg-surface px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">Total</p>
            <p className="font-display text-2xl tabular-nums">{formatINR(totals.total)}</p>
          </div>
          <Button type="submit" disabled={busy} className="min-w-40">
            {busy ? 'Saving…' : order ? 'Save changes' : 'Add order'}
          </Button>
        </div>
      </form>
    </Page>
  )
}
