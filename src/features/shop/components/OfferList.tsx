import { useState } from 'react'
import { Button, ConfirmDialog, EmptyState, ErrorState, Skeleton } from '../../../components/ui'
import { formatINR } from '../../../lib/money'
import { offerState, type OfferStatus } from '../../../lib/offers'
import { variantLabel } from '../../../lib/variants'
import { effectivePricePaise } from '../../../lib/pricing'
import { useEndOffers, useOfferVariants } from '../hooks/useShop'
import type { OfferVariant } from '../schemas'
import { BulkOfferBar } from './BulkOfferBar'
import { OfferSheet } from './OfferSheet'

const STATUS: Record<OfferStatus, { text: string; cls: string }> = {
  none: { text: '', cls: '' },
  active: { text: 'Offer on', cls: 'bg-success-soft text-success-ink' },
  scheduled: { text: 'Scheduled', cls: 'bg-info-soft text-info-ink' },
  ended: { text: 'Ended', cls: 'bg-surface-2 text-muted' },
}

function Row({ v, ticked, onTick, onEdit }: { v: OfferVariant; ticked: boolean; onTick: () => void; onEdit: () => void }) {
  const s = offerState(v)
  const eff = effectivePricePaise({ price: v.price, offer_price: v.offer_price, offer_starts_at: v.offer_starts_at, offer_ends_at: v.offer_ends_at })
  return (
    <li className="flex min-h-14 items-center gap-3 px-4 py-2">
      <input type="checkbox" className="h-5 w-5 shrink-0" checked={ticked} onChange={onTick} aria-label={`Select ${v.products.name} ${variantLabel(v)}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{variantLabel(v)}</p>
        <p className="text-sm text-muted">
          {eff < v.price ? (
            <>
              <s>{formatINR(v.price)}</s> <span className="font-medium text-text">{formatINR(eff)}</span>
            </>
          ) : (
            formatINR(v.price)
          )}
          {s.hint && ` · ${s.hint}`}
        </p>
      </div>
      {s.status !== 'none' && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[s.status].cls}`}>{STATUS[s.status].text}</span>}
      <Button variant="secondary" onClick={onEdit}>
        Offer
      </Button>
    </li>
  )
}

export function OfferList() {
  const variants = useOfferVariants()
  const endAll = useEndOffers()
  const [ticked, setTicked] = useState<string[]>([])
  const [editing, setEditing] = useState<OfferVariant | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)

  if (variants.isPending) return <Skeleton className="h-40 w-full" />
  if (variants.isError) return <ErrorState error={variants.error} onRetry={() => void variants.refetch()} />
  if (variants.data.length === 0) {
    return <EmptyState title="No products yet" description="Add products in Products, then set offers here." />
  }

  const byProduct = new Map<string, OfferVariant[]>()
  for (const v of variants.data) byProduct.set(v.products.id, [...(byProduct.get(v.products.id) ?? []), v])
  const toggle = (id: string) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))
  const anyOffer = variants.data.some((v) => v.offer_price !== null)

  return (
    <div className="flex flex-col gap-3">
      {ticked.length > 0 && <BulkOfferBar ids={ticked} onDone={() => setTicked([])} />}
      {[...byProduct.values()].map((rows) => (
        <section key={rows[0]?.products.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
          <h3 className="border-b border-border px-4 py-2 font-medium">{rows[0]?.products.name}</h3>
          <ul className="divide-y divide-border">
            {rows.map((v) => (
              <Row key={v.id} v={v} ticked={ticked.includes(v.id)} onTick={() => toggle(v.id)} onEdit={() => setEditing(v)} />
            ))}
          </ul>
        </section>
      ))}
      {anyOffer && (
        <Button variant="ghost" className="text-danger" onClick={() => setConfirmEnd(true)}>
          End all offers
        </Button>
      )}
      {editing && <OfferSheet variant={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={confirmEnd}
        title="End all offers?"
        message="Every item goes back to its normal price straight away."
        confirmLabel="End all offers"
        destructive
        busy={endAll.isPending}
        onConfirm={() => endAll.mutate(null, { onSuccess: () => setConfirmEnd(false) })}
        onCancel={() => setConfirmEnd(false)}
      />
    </div>
  )
}
