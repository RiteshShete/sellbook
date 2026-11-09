import { Button, ErrorState } from '../../../components/ui'
import { formatDateTime } from '../../../lib/dates'
import { pluralize } from '../../../lib/format'
import { useImportBatches, useUndoImport } from '../hooks/useImport'

/** The last imports, each with its own Undo until it has been undone. */
export function RecentImports() {
  const batches = useImportBatches()
  const undo = useUndoImport()

  if (batches.isError) {
    return <ErrorState error={batches.error} onRetry={() => void batches.refetch()} />
  }
  if (!batches.data || batches.data.length === 0) return null

  return (
    <section aria-labelledby="recent-h" className="flex flex-col gap-2">
      <h2 id="recent-h" className="font-display text-xl">
        Recent imports
      </h2>
      <ul className="flex flex-col gap-2">
        {batches.data.map((b) => (
          <li
            key={b.id}
            className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-3"
          >
            <div className="min-w-0 text-sm">
              <p className="font-medium break-words">{b.file_name || 'Pasted text'}</p>
              <p className="text-muted">
                {formatDateTime(b.created_at)} · {pluralize(b.counts.products, 'product')},{' '}
                {pluralize(b.counts.variants, 'variant')}
                {b.counts.updated > 0 ? `, ${pluralize(b.counts.updated, 'price')} updated` : ''}
              </p>
            </div>
            {b.undone_at ? (
              <span className="shrink-0 text-sm text-muted">Undone</span>
            ) : (
              <Button
                variant="secondary"
                className="shrink-0"
                disabled={undo.isPending}
                aria-label={`Undo import of ${b.file_name || 'pasted text'}`}
                onClick={() => undo.mutate(b.id)}
              >
                Undo
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
