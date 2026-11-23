import { useMutation } from '@tanstack/react-query'
import { useRef } from 'react'
import { Button, toast } from '../../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { catalogImageUrl, removeCatalogImages, uploadCatalogImage } from '../api/shopApi'
import { useUpdateShop } from '../hooks/useShop'

/** The shop logo (400 px, shown on the shop page). Stored in the public catalog bucket under the shop's own folder. */
export function ShopLogo({ path }: { path: string | null }) {
  const { client, session } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const update = useUpdateShop()
  const ownerId = session?.user.id ?? ''

  const change = useMutation({
    mutationFn: async (file: File) => {
      const next = await uploadCatalogImage(client, ownerId, 'logo', file, 'logo')
      await update.mutateAsync({ logo_path: next })
      if (path) await removeCatalogImages(client, [path], false).catch(() => undefined) // the old file is only clutter
    },
    onSuccess: () => toast.success('Logo saved'),
  })
  const remove = useMutation({
    mutationFn: async () => {
      await update.mutateAsync({ logo_path: null })
      if (path) await removeCatalogImages(client, [path], false)
    },
  })

  return (
    <div className="flex items-center gap-4">
      {path ? (
        <img src={catalogImageUrl(client, path)} alt="Shop logo" className="h-16 w-16 rounded-xl border border-border object-cover" />
      ) : (
        <div className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-border-strong text-xs text-muted">No logo</div>
      )}
      <div className="flex flex-col gap-1">
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) change.mutate(file)
          }}
        />
        <Button variant="secondary" disabled={change.isPending} onClick={() => input.current?.click()}>
          {change.isPending ? 'Uploading…' : path ? 'Change logo' : 'Add logo'}
        </Button>
        {path && (
          <Button variant="ghost" className="text-danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}
