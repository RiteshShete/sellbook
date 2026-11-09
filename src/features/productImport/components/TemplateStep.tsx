import { Copy, Download } from 'lucide-react'
import { Badge, Button, toast } from '../../../components/ui'
import { copyText, downloadText } from '../files'
import {
  EXAMPLE_FILE,
  IMPORT_COLUMNS,
  TEMPLATE_FILE,
  TEMPLATE_TEXT,
  exampleCsv,
  templateCsv,
} from '../importSchema'

/** Step 1: template and example downloads, copyable template text, and the column guide. */
export function TemplateStep({ announce }: { announce: (message: string) => void }) {
  async function copyTemplate() {
    const ok = await copyText(TEMPLATE_TEXT)
    const msg = ok
      ? 'Template text copied'
      : 'Could not copy. Select the text and copy it yourself.'
    if (ok) toast.success(msg)
    else toast.error(msg)
    announce(msg)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">
        The CSV has one row per variant: repeat the product name for each size or type.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button onClick={() => downloadText(TEMPLATE_FILE, templateCsv())}>
          <Download className="h-4 w-4" aria-hidden /> Download template (CSV)
        </Button>
        <Button variant="secondary" onClick={() => downloadText(EXAMPLE_FILE, exampleCsv())}>
          <Download className="h-4 w-4" aria-hidden /> Download example (CSV)
        </Button>
        <Button variant="secondary" onClick={() => void copyTemplate()}>
          <Copy className="h-4 w-4" aria-hidden /> Copy template text
        </Button>
      </div>

      <section aria-labelledby="columns-h" className="flex flex-col gap-2">
        <h3 id="columns-h" className="font-display text-lg">
          What each column means
        </h3>
        <ul className="flex flex-col gap-2">
          {IMPORT_COLUMNS.map((c) => (
            <li
              key={c.name}
              className="min-w-0 rounded-2xl border border-border bg-surface p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <code className="font-semibold break-all">{c.name}</code>
                <Badge kind={c.required ? 'importError' : 'neutral'}>
                  {c.required ? 'Required' : 'Optional'}
                </Badge>
              </div>
              <p className="mt-1">{c.meaning}</p>
              <p className="text-muted">Allowed: {c.allowed}</p>
              <p className="text-muted">
                Example: <span className="text-text">{c.example}</span>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
