import { Download } from 'lucide-react'
import { useState } from 'react'
import { Button, Chip } from '../../../components/ui'
import { downloadText, errorReportCsv } from '../files'
import type { ImportPlan, Issue } from '../planImport'

type Filter = 'all' | 'errors' | 'warnings'

/** Errors and warnings with their row numbers, filterable, plus the CSV error report. */
export function IssueList({ plan }: { plan: ImportPlan }) {
  const [filter, setFilter] = useState<Filter>('all')
  const rows: { kind: 'Error' | 'Warning'; issue: Issue }[] = [
    ...(filter === 'warnings'
      ? []
      : plan.errors.map((issue) => ({ kind: 'Error' as const, issue }))),
    ...(filter === 'errors'
      ? []
      : plan.warnings.map((issue) => ({ kind: 'Warning' as const, issue }))),
  ]
  if (plan.errors.length === 0 && plan.warnings.length === 0) return null

  return (
    <section aria-labelledby="issues-h" className="flex flex-col gap-2">
      <h3 id="issues-h" className="font-display text-lg">
        Errors and warnings
      </h3>
      <div className="flex flex-wrap gap-2">
        <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
          All ({plan.errors.length + plan.warnings.length})
        </Chip>
        <Chip selected={filter === 'errors'} onClick={() => setFilter('errors')}>
          Errors ({plan.errors.length})
        </Chip>
        <Chip selected={filter === 'warnings'} onClick={() => setFilter('warnings')}>
          Warnings ({plan.warnings.length})
        </Chip>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map(({ kind, issue }, i) => (
          <li
            key={`${kind}-${issue.line}-${i}`}
            className={`rounded-xl px-3 py-2 break-words ${kind === 'Error' ? 'bg-danger-soft text-danger-ink' : 'bg-surface-2 text-text'}`}
          >
            <strong className="font-semibold">{kind}</strong>
            {issue.line === null ? '' : `, row ${issue.line}`}: {issue.message}
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        onClick={() => downloadText('sellbook-import-errors.csv', errorReportCsv(plan))}
      >
        <Download className="h-4 w-4" aria-hidden /> Download error report (CSV)
      </Button>
    </section>
  )
}
