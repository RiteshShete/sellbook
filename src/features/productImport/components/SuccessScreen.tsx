import { CheckCircle2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui'
import { pluralize } from '../../../lib/format'
import type { ApplyResult } from '../api/importApi'
import { useUndoImport } from '../hooks/useImport'

/** After a successful save: counts, View products, Undo import. */
export function SuccessScreen({ result, onAgain }: { result: ApplyResult; onAgain: () => void }) {
  const undo = useUndoImport()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])

  if (undo.isSuccess) {
    return (
      <div className="flex flex-col gap-3">
        <h2 ref={heading} tabIndex={-1} className="font-display text-2xl outline-none">
          Import undone
        </h2>
        <p className="text-muted">
          The new products moved to Trash (you can restore them there) and changed prices went back.
        </p>
        <Button onClick={onAgain}>Import another file</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h2
        ref={heading}
        tabIndex={-1}
        className="font-display flex items-center gap-2 text-2xl outline-none"
      >
        <CheckCircle2 className="h-6 w-6 shrink-0 text-success" aria-hidden /> Import saved
      </h2>
      <ul className="text-body">
        <li>{pluralize(result.products, 'product')} created</li>
        <li>{pluralize(result.variants, 'variant')} created</li>
        <li>{pluralize(result.categories, 'category', 'categories')} created</li>
        <li>{pluralize(result.updated, 'price')} updated</li>
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          to="/catalog"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-fg"
        >
          View products
        </Link>
        <Button
          variant="secondary"
          disabled={undo.isPending}
          onClick={() => undo.mutate(result.batch_id)}
        >
          {undo.isPending ? 'Undoing...' : 'Undo import'}
        </Button>
      </div>
    </div>
  )
}
