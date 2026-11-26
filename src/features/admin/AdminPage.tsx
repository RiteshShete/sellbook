import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { NotFoundPage } from '../../app/NotFoundPage'
import { Page } from '../../app/Page'
import { Button, EmptyState, ErrorState, Input, SegmentedControl, Skeleton } from '../../components/ui'
import { isValidVpa } from '../../lib/upi'
import { usePlan } from '../plan/hooks/usePlan'
import { REQUEST_STATUSES, type ConfigKey, type RequestStatus } from './adminApi'
import { RequestRow } from './components/RequestRow'
import { ShopsSection } from './components/ShopsSection'
import { StatsCard } from './components/StatsCard'
import { useAdminRequests, useIsAdmin, useSetConfig } from './useAdmin'

const TABS = REQUEST_STATUSES.map((s) => ({ value: s, label: s[0]?.toUpperCase() + s.slice(1) }))

/**
 * Platform admin only: approve or reject plan payments, and set where shops pay.
 * Anyone else sees "not found"; the server refuses them as well. /admin?req=<id> marks one request
 * (the link in the notification email).
 */
export function AdminPage() {
  const admin = useIsAdmin()
  const [params] = useSearchParams()
  const [status, setStatus] = useState<RequestStatus>('pending')

  if (admin.isPending) {
    return (
      <Page title="Admin" back="/more">
        <div role="status" aria-label="Loading">
          <Skeleton className="h-24 w-full" />
        </div>
      </Page>
    )
  }
  if (!admin.data) return <NotFoundPage />

  return (
    <Page title="Admin" back="/more">
      <div className="flex flex-col gap-4">
        <StatsCard />
        <h2 className="font-display text-xl">Plan payments</h2>
        <SegmentedControl label="Show requests" options={TABS} value={status} onChange={setStatus} />
        <Requests status={status} marked={params.get('req')} />
        <h2 className="mt-4 font-display text-xl">Shops and plans</h2>
        <ShopsSection />
        <h2 className="mt-4 font-display text-xl">Where shops pay</h2>
        <PayTo />
      </div>
    </Page>
  )
}

function Requests({ status, marked }: { status: RequestStatus; marked: string | null }) {
  const list = useAdminRequests(status)
  if (list.isPending) {
    return (
      <div role="status" aria-label="Loading">
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }
  if (list.isError) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />
  if (list.data.length === 0) {
    return (
      <EmptyState
        title={status === 'pending' ? 'Nothing to approve' : `No ${status} requests`}
        description={status === 'pending' ? 'New payment claims from shops show up here.' : undefined}
      />
    )
  }
  // The request from the email link first.
  const rows = [...list.data].sort((a, b) => Number(b.id === marked) - Number(a.id === marked))
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <RequestRow key={r.id} request={r} highlight={r.id === marked} />
      ))}
    </ul>
  )
}

const FIELDS: { key: ConfigKey; label: string }[] = [
  { key: 'upi_id', label: 'UPI ID (shops pay here)' },
  { key: 'payee_name', label: 'Payee name (shown in the UPI app)' },
  { key: 'support_email', label: 'Support email (shown to shops)' },
]

/** The platform's own payment details. Each field saves by itself. */
function PayTo() {
  const plan = usePlan()
  if (!plan.data) return <Skeleton className="h-24 w-full" />
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Check the UPI ID twice: a wrong one sends every shop&apos;s payment to someone else.
      </p>
      {FIELDS.map((f) => (
        <ConfigField key={f.key} field={f} saved={plan.data.pay_to?.[f.key] ?? ''} />
      ))}
    </div>
  )
}

function ConfigField({ field, saved }: { field: (typeof FIELDS)[number]; saved: string }) {
  const save = useSetConfig()
  const [value, setValue] = useState(saved)
  const trimmed = value.trim()
  const error =
    field.key === 'upi_id' && trimmed !== '' && !isValidVpa(trimmed) ? 'Looks like name@bank' : undefined
  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <Input label={field.label} value={value} error={error} onChange={(e) => setValue(e.target.value)} />
      </div>
      <Button
        variant="secondary"
        disabled={trimmed === '' || trimmed === saved || error !== undefined || save.isPending}
        onClick={() => save.mutate({ key: field.key, value: trimmed })}
      >
        Save
      </Button>
    </div>
  )
}
