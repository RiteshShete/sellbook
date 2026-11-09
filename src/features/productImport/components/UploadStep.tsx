import { useId, useState } from 'react'
import { Button, Textarea } from '../../../components/ui'
import { decodeUtf8, parseImportText, type ParseFailure } from '../parseImport'
import type { ReviewInput } from './ReviewScreen'

type Tab = 'file' | 'paste'

interface Props {
  onParsed: (input: ReviewInput) => void
  onShowTemplate: () => void
  announce: (message: string) => void
}

/** Step 3: upload a file or paste the AI's answer. Nothing is saved here; parsing is local. */
export function UploadStep({ onParsed, onShowTemplate, announce }: Props) {
  const [tab, setTab] = useState<Tab>('file')
  const [text, setText] = useState('')
  const [failure, setFailure] = useState<ParseFailure | null>(null)
  const id = useId()

  function run(source: string, fileName: string) {
    const out = parseImportText(source)
    if (!out.ok) {
      setFailure(out)
      announce(out.message)
      return
    }
    setFailure(null)
    announce(`Read ${out.rows.length} rows. Review them before saving.`)
    onParsed({ ...out, fileName })
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    const decoded = decodeUtf8(new Uint8Array(await file.arrayBuffer()))
    if (!decoded.ok) {
      setFailure(decoded)
      announce(decoded.message)
      return
    }
    run(decoded.text, file.name)
  }

  const tabClass = (t: Tab) =>
    `min-h-11 flex-1 border-b-2 px-3 text-sm font-medium ${tab === t ? 'border-text text-text' : 'border-transparent text-muted'}`

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="How to add your CSV" className="flex border-b border-border">
        <button
          type="button"
          role="tab"
          id={`${id}-t-file`}
          aria-selected={tab === 'file'}
          aria-controls={`${id}-p-file`}
          className={tabClass('file')}
          onClick={() => setTab('file')}
        >
          Upload file
        </button>
        <button
          type="button"
          role="tab"
          id={`${id}-t-paste`}
          aria-selected={tab === 'paste'}
          aria-controls={`${id}-p-paste`}
          className={tabClass('paste')}
          onClick={() => setTab('paste')}
        >
          Paste CSV text
        </button>
      </div>

      {tab === 'file' ? (
        <div
          role="tabpanel"
          id={`${id}-p-file`}
          aria-labelledby={`${id}-t-file`}
          className="flex flex-col gap-1"
        >
          <label htmlFor={`${id}-file`} className="text-sm font-medium text-muted">
            CSV file (.csv or .txt, up to 1 MB)
          </label>
          {/* Android pickers report odd MIME types, so .csv / .txt are listed beside text/*. */}
          <input
            id={`${id}-file`}
            type="file"
            accept=".csv,.txt,text/*"
            onChange={(e) => {
              void onFile(e.target.files?.[0])
              e.target.value = ''
            }}
            className="min-h-11 w-full rounded-xl border border-border-strong bg-surface p-2 text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-surface-2 file:px-4 file:font-medium"
          />
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`${id}-p-paste`}
          aria-labelledby={`${id}-t-paste`}
          className="flex flex-col gap-2"
        >
          <Textarea
            label="Paste the CSV the AI gave you"
            rows={8}
            value={text}
            spellCheck={false}
            autoCapitalize="off"
            placeholder="product_name,category,variant_name,size,unit,price,cost_price,active,notes"
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-sm"
          />
          <Button disabled={text.trim() === ''} onClick={() => run(text, '')}>
            Check pasted text
          </Button>
        </div>
      )}

      {failure && (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-danger-ink"
        >
          <p>{failure.message}</p>
          {(failure.kind === 'headers' || failure.kind === 'empty') && (
            <button
              type="button"
              onClick={onShowTemplate}
              className="min-h-11 font-medium underline underline-offset-4"
            >
              Back to the template
            </button>
          )}
        </div>
      )}
    </div>
  )
}
