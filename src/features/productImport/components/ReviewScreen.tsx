import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, ConfirmDialog, ErrorState, Skeleton } from '../../../components/ui'
import { pluralize } from '../../../lib/format'
import { useCategories, useProducts } from '../../catalog/hooks/useCatalog'
import type { ApplyResult } from '../api/importApi'
import { useOnline } from '../files'
import { useApplyImport } from '../hooks/useImport'
import type { ImportRow } from '../parseImport'
import { isEmptyPlan, planImport, planSignature, type ImportMode } from '../planImport'
import { IssueList } from './IssueList'
import { PlanSummary } from './PlanSummary'
import { ProductPlanCard } from './ProductPlanCard'

export interface ReviewInput {
  rows: ImportRow[]
  fileWarnings: string[]
  fileName: string
  looksLikeExample: boolean
}

interface Props extends ReviewInput {
  onBack: () => void
  onDone: (result: ApplyResult) => void
  announce: (message: string) => void
}

const MODES: { value: ImportMode; title: string; help: string }[] = [
  {
    value: 'add',
    title: 'Add new only (recommended)',
    help: 'Creates new products, variants and categories. Never changes an existing price. Uploading the same file again creates nothing.',
  },
  {
    value: 'update',
    title: 'Add and update prices',
    help: 'Also changes price, cost and active for variants that already exist (matched by product, variant name, size and unit). Every change is shown before you save.',
  },
]

/** Nothing is saved until the owner confirms here. The plan re-runs whenever the catalog changes. */
export function ReviewScreen({
  rows,
  fileWarnings,
  fileName,
  looksLikeExample,
  onBack,
  onDone,
  announce,
}: Props) {
  const products = useProducts()
  const categories = useCategories()
  const apply = useApplyImport()
  const online = useOnline()
  const heading = useRef<HTMLHeadingElement>(null)
  const [mode, setMode] = useState<ImportMode>('add')
  const [skipErrors, setSkipErrors] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [ack, setAck] = useState<string | null>(null)

  // Parsing just finished: move focus to the review heading.
  useEffect(() => heading.current?.focus(), [])

  const plan = useMemo(
    () =>
      products.data && categories.data
        ? planImport(
            { products: products.data, categories: categories.data.categories },
            rows,
            mode,
            fileName,
            fileWarnings,
          )
        : null,
    [products.data, categories.data, rows, mode, fileName, fileWarnings],
  )
  const sig = plan ? planSignature(plan) : null
  // The reviewed plan is remembered; a different live plan means the catalog changed under us.
  if (ack === null && sig !== null) setAck(sig)
  const changed = ack !== null && sig !== null && ack !== sig

  if (products.isError || categories.isError) {
    return (
      <ErrorState
        error={products.error ?? categories.error}
        onRetry={() => void Promise.all([products.refetch(), categories.refetch()])}
      />
    )
  }
  if (!plan) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  const c = plan.counts
  const nothing = isEmptyPlan(plan)
  const blockedByErrors = c.errorRows > 0 && !skipErrors
  const summary = `${pluralize(c.products, 'product')} (${pluralize(c.variants, 'variant')})`
  const label =
    mode === 'update' && c.updates > 0
      ? `Import ${summary}, update ${pluralize(c.updates, 'price')}`
      : `Import ${summary}`
  const reason = !online
    ? 'You are offline. Connect to the internet to save.'
    : changed
      ? 'The catalog changed. Check the plan below, then tap "I checked the changes".'
      : nothing
        ? 'Nothing to import: everything in this file already exists.'
        : blockedByErrors
          ? `Tick "Skip the ${pluralize(c.errorRows, 'row')} with errors" or fix the file and upload it again.`
          : null

  async function confirm() {
    // Re-run against the freshest catalog before writing; stop and say so if it changed.
    const [p, k] = await Promise.all([products.refetch(), categories.refetch()])
    if (!p.data || !k.data) {
      setConfirming(false)
      return
    }
    const fresh = planImport(
      { products: p.data, categories: k.data.categories },
      rows,
      mode,
      fileName,
      fileWarnings,
    )
    if (planSignature(fresh) !== ack) {
      setConfirming(false)
      announce(
        'The catalog changed while you were reviewing. Nothing was saved. Check the plan again.',
      )
      return
    }
    announce(`Saving ${summary}...`)
    apply.mutate(fresh.payload, {
      onSuccess: (r) => {
        announce(`Import finished: ${r.products} products, ${r.variants} variants.`)
        onDone(r)
      },
      onError: () => announce('Import failed. Nothing was saved.'),
      onSettled: () => setConfirming(false),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <h2
        ref={heading}
        tabIndex={-1}
        className="font-display text-2xl outline-none focus-visible:ring-2 focus-visible:ring-text"
      >
        Review before saving
      </h2>
      <p className="text-muted">
        {fileName === '' ? 'Pasted text' : fileName}: {pluralize(rows.length, 'row')}. Nothing is
        saved yet.
      </p>

      {looksLikeExample && (
        <p role="alert" className="rounded-xl bg-ochre px-3 py-2 text-sm text-text">
          This looks like the example file. Import it only to try the app; you can undo it
          afterwards.
        </p>
      )}
      {changed && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl bg-info-soft px-3 py-2 text-sm text-info-ink"
        >
          <p>
            The catalog changed while you were reviewing (maybe on another device). The plan below
            is updated.
          </p>
          <Button variant="secondary" onClick={() => setAck(sig)}>
            I checked the changes
          </Button>
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-muted">What should the import do?</legend>
        {MODES.map((m) => (
          <label
            key={m.value}
            className={`flex min-h-11 cursor-pointer gap-3 rounded-2xl border p-3 ${mode === m.value ? 'border-text bg-surface-2' : 'border-border-strong bg-surface'}`}
          >
            <input
              type="radio"
              name="import-mode"
              value={m.value}
              checked={mode === m.value}
              onChange={() => {
                setMode(m.value)
                setAck(null)
              }}
              className="mt-1 h-5 w-5 shrink-0 accent-text"
            />
            <span className="min-w-0">
              <span className="block font-medium">{m.title}</span>
              <span className="block text-sm text-muted">{m.help}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <PlanSummary counts={c} />
      <IssueList plan={plan} />

      <ul className="flex flex-col gap-3" aria-label="Products in this file">
        {plan.products.map((p) => (
          <ProductPlanCard key={p.key} product={p} />
        ))}
      </ul>

      {c.errorRows > 0 && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={skipErrors}
            onChange={(e) => setSkipErrors(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-text"
          />
          <span>Skip the {pluralize(c.errorRows, 'row')} with errors</span>
        </label>
      )}

      {reason && <p className="text-sm text-muted">{reason}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" onClick={onBack} disabled={apply.isPending}>
          Choose another file
        </Button>
        <Button
          className="sm:flex-1"
          disabled={reason !== null || apply.isPending}
          onClick={() => setConfirming(true)}
        >
          {apply.isPending ? 'Saving...' : label}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Save this import?"
        message={`${label}.${mode === 'update' ? ` ${pluralize(c.updates, 'price')} will change.` : ''} You can undo it afterwards.`}
        confirmLabel="Save import"
        busy={apply.isPending}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
