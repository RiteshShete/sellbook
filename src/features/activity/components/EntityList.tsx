import { ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, EmptyState, ErrorState, Skeleton } from '../../../components/ui'
import { useDebouncedValue } from '../../../lib/useDebouncedValue'
import type { EntityKind } from '../api/activityApi'
import { useEntityList } from '../hooks/useActivity'

const COPY: Record<EntityKind, { empty: string; placeholder: string }> = {
  order: { empty: 'No orders found', placeholder: 'Search #number or customer' },
  product: { empty: 'No products yet', placeholder: 'Search products' },
  variant: { empty: 'No variants yet', placeholder: 'Search variants' },
}

/** Orders by #number, products or variants: pick one to read its log. */
export function EntityList({ kind }: { kind: EntityKind }) {
  const [text, setText] = useState('')
  const search = useDebouncedValue(text, 300)
  // Orders search on the server (there can be thousands); products and variants are few, so filter here.
  const list = useEntityList(kind, search)
  const needle = text.trim().toLowerCase()
  const items = (list.data?.pages.flat() ?? []).filter(
    (i) => kind === 'order' || `${i.title} ${i.subtitle ?? ''}`.toLowerCase().includes(needle),
  )

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">{COPY[kind].placeholder}</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={COPY[kind].placeholder}
          className="min-h-12 w-full rounded-xl border border-border-strong bg-surface pr-4 pl-10 outline-none focus:border-text focus:ring-1 focus:ring-text"
        />
      </label>
      {list.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Loading">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={COPY[kind].empty} />
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {items.map((i) => (
              <li key={i.id}>
                <Link
                  to={`/activity/${kind}/${i.id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{i.title}</span>
                    {i.subtitle && (
                      <span className="block truncate text-sm text-muted">{i.subtitle}</span>
                    )}
                  </span>
                  {i.trashed && <Badge>In Trash</Badge>}
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          {list.hasNextPage && (
            <Button
              variant="secondary"
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
