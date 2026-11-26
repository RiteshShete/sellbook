import { useState } from 'react'
import { Button, Modal, Select } from '../../../components/ui'
import { formatDate } from '../../../lib/dates'
import { TIERS, TIER_LABEL, type Tier } from '../../plan/schemas'
import type { AdminShop } from '../adminApi'
import { useSetSubscription } from '../useAdmin'

const STATUS_LABEL: Record<AdminShop['status'], string> = {
  trial: 'Free trial',
  active: 'Active',
  grace_readonly: 'Ended (read-only)',
  locked: 'Locked',
}

/** Value is "lifetime" or a number of days; "0" ends the plan now. */
const LENGTHS = [
  { value: 'lifetime', label: 'Lifetime (no end)' },
  { value: '30', label: '30 days from now' },
  { value: '90', label: '90 days from now' },
  { value: '365', label: '1 year from now' },
  { value: '0', label: 'End it now (read-only)' },
]

/** One shop with its plan. "Change plan" is the manual override for demo, promo and lifetime accounts. */
export function ShopRow({ shop: s }: { shop: AdminShop }) {
  const set = useSetSubscription()
  const [open, setOpen] = useState(false)
  const [tier, setTier] = useState<Tier>(s.tier)
  const [length, setLength] = useState(s.lifetime ? 'lifetime' : '30')

  const save = () =>
    set.mutate(
      { owner: s.owner_id, tier, lifetime: length === 'lifetime', days: length === 'lifetime' ? 0 : Number(length) },
      { onSuccess: () => setOpen(false) },
    )

  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate font-medium">{s.shop_name || s.email || s.phone}</p>
        <p className="shrink-0 font-semibold">{TIER_LABEL[s.tier]}</p>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">Login</dt>
        <dd className="break-all">{s.email ?? s.phone ?? 'unknown'}</dd>
        <dt className="text-muted">Status</dt>
        <dd>{STATUS_LABEL[s.status]}</dd>
        <dt className="text-muted">Runs until</dt>
        <dd>{s.lifetime ? 'Lifetime' : formatDate(s.ends_at)}</dd>
        <dt className="text-muted">Orders this month</dt>
        <dd className="tabular-nums">{s.orders_this_month}</dd>
        <dt className="text-muted">Joined</dt>
        <dd>{formatDate(s.created_at)}</dd>
      </dl>
      <Button className="mt-3" block variant="secondary" onClick={() => setOpen(true)}>
        Change plan
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Plan for ${s.shop_name || s.email || s.phone}`}>
        <div className="flex flex-col gap-3">
          <Select
            label="Plan"
            value={tier}
            onChange={(e) => setTier(e.target.value as Tier)}
            options={TIERS.map((t) => ({ value: t, label: TIER_LABEL[t] }))}
          />
          <Select label="How long" value={length} onChange={(e) => setLength(e.target.value)} options={LENGTHS} />
          <p className="text-sm text-muted">
            This changes the plan at once, with no payment needed. The shop sees it the next time it opens the app.
          </p>
          <Button block disabled={set.isPending} onClick={save}>
            {set.isPending ? 'Saving…' : 'Save plan'}
          </Button>
        </div>
      </Modal>
    </li>
  )
}
