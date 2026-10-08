import { ImageUp } from 'lucide-react'
import { useRef } from 'react'
import { Button, Skeleton } from '../../../components/ui'
import { useAssetChange, useAssetUrl } from '../hooks/useSettings'
import { ASSET_COLUMN, type AssetKind, type Settings } from '../schemas'

export interface AssetFieldProps {
  kind: AssetKind
  label: string
  hint: string
  settings: Settings
}

/** Image picker with a preview of the stored (private) file. */
export function AssetField({ kind, label, hint, settings }: AssetFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const path = settings[ASSET_COLUMN[kind]]
  const preview = useAssetUrl(path)
  const change = useAssetChange(kind)

  function onPick(files: FileList | null) {
    const file = files?.[0]
    if (file) change.mutate({ settings, file })
    if (inputRef.current) inputRef.current.value = '' // allow picking the same file again
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div>
        <h2 className="font-semibold">{label}</h2>
        <p className="text-sm text-muted">{hint}</p>
      </div>

      {path === null ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-muted">
          <ImageUp className="h-8 w-8" aria-hidden="true" />
          <span className="sr-only">No image yet</span>
        </div>
      ) : preview.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : preview.error ? (
        <div role="alert" className="flex h-40 flex-col items-center justify-center gap-2 text-sm">
          <span className="text-muted">Could not load the image.</span>
          <Button variant="secondary" onClick={() => void preview.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <img src={preview.url} alt={label} className="mx-auto max-h-56 rounded-xl object-contain" />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => onPick(e.target.files)}
        aria-label={`Choose ${label}`}
      />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={change.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {change.isPending ? 'Saving…' : path ? 'Replace' : 'Upload'}
        </Button>
        {path && (
          <Button
            variant="ghost"
            className="text-danger"
            disabled={change.isPending}
            onClick={() => change.mutate({ settings, file: null })}
          >
            Remove
          </Button>
        )}
      </div>
    </section>
  )
}
