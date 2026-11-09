import { FileUp, PencilLine } from 'lucide-react'
import { Link } from 'react-router-dom'

const card =
  'flex min-h-28 min-w-0 flex-1 flex-col items-start gap-2 rounded-2xl border border-border-strong bg-surface p-4 text-left active:bg-surface-2'

/** Empty Products screen: two equal ways to start. */
export function ImportEntryCards() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link to="/catalog/new" className={card}>
        <PencilLine className="h-6 w-6" aria-hidden />
        <span className="font-display text-lg">Add products one by one</span>
        <span className="text-sm text-muted">Type each product and its prices.</span>
      </Link>
      <Link to="/catalog/configure" className={card}>
        <FileUp className="h-6 w-6" aria-hidden />
        <span className="font-display text-lg">Import from a photo or menu</span>
        <span className="text-sm text-muted">Let an AI tool turn your price list into a file.</span>
      </Link>
    </div>
  )
}

/** New order screen with no products: the import card next to the add link. */
export function ImportCardCompact() {
  return (
    <Link to="/catalog/configure" className={card}>
      <FileUp className="h-6 w-6" aria-hidden />
      <span className="font-display text-lg">Import from a photo or menu</span>
      <span className="text-sm text-muted">Make many products at once.</span>
    </Link>
  )
}
