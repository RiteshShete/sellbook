import { useState } from 'react'
import { EmptyState, ErrorState, Input, Skeleton } from '../../../components/ui'
import { useAdminShops } from '../useAdmin'
import { ShopRow } from './ShopRow'

/** Every shop with its plan; search by email, mobile or shop name. */
export function ShopsSection() {
  const [query, setQuery] = useState('')
  const shops = useAdminShops(query)
  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Search shops"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Email, mobile or shop name"
      />
      {shops.isPending ? (
        <div role="status" aria-label="Loading">
          <Skeleton className="h-32 w-full" />
        </div>
      ) : shops.isError ? (
        <ErrorState error={shops.error} onRetry={() => void shops.refetch()} />
      ) : shops.data.length === 0 ? (
        <EmptyState title="No shops found" description={query ? 'Try a different search.' : undefined} />
      ) : (
        <ul className="flex flex-col gap-3">
          {shops.data.map((s) => (
            <ShopRow key={s.owner_id} shop={s} />
          ))}
        </ul>
      )}
    </div>
  )
}
