import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Camera } from 'lucide-react'
import { useRef } from 'react'
import { Button, toast } from '../../../components/ui'
import { thumbPath } from '../../../lib/imageResize'
import { useAuth } from '../../auth/useAuth'
import { catalogImageUrl, removeCatalogImages, uploadCatalogImage } from '../../shop/api/shopApi'
import { useSaveOnlineDetails } from '../../shop/hooks/useShop'
import { movePhoto } from '../photoOrder'

const MAX = 5

/** Up to 5 pictures of a product; the first is the cover. Each change is saved at once. */
export function ProductPhotos({ productId, paths }: { productId: string; paths: string[] }) {
  const { client, session } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const save = useSaveOnlineDetails(productId)
  const ownerId = session?.user.id ?? ''

  const add = useMutation({
    mutationFn: async (file: File) => {
      const path = await uploadCatalogImage(client, ownerId, `p/${productId}`, file, 'product')
      await save.mutateAsync({ image_paths: [...paths, path] })
    },
    onSuccess: () => toast.success('Picture added'),
  })
  const remove = useMutation({
    mutationFn: async (path: string) => {
      await save.mutateAsync({ image_paths: paths.filter((p) => p !== path) })
      await removeCatalogImages(client, [path], true)
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-medium">Pictures ({paths.length} of {MAX})</h3>
      <ul className="grid grid-cols-2 gap-3">
        {paths.map((p, i) => (
          <li key={p} className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-2">
            <img
              src={catalogImageUrl(client, thumbPath(p))}
              alt={`Picture ${i + 1}${i === 0 ? ' (cover)' : ''}`}
              loading="lazy"
              className="aspect-square w-full rounded-lg object-cover"
            />
            <div className="flex flex-wrap gap-1">
              {i === 0 ? (
                <span className="px-1 text-sm text-muted">Cover</span>
              ) : (
                <Button variant="secondary" onClick={() => save.mutate({ image_paths: [p, ...paths.filter((x) => x !== p)] })}>
                  Make cover
                </Button>
              )}
              {i > 0 && (
                <Button variant="ghost" aria-label={`Move picture ${i + 1} earlier`} disabled={save.isPending} onClick={() => save.mutate({ image_paths: movePhoto(paths, i, -1) })}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              {i < paths.length - 1 && (
                <Button variant="ghost" aria-label={`Move picture ${i + 1} later`} disabled={save.isPending} onClick={() => save.mutate({ image_paths: movePhoto(paths, i, 1) })}>
                  <ArrowRight className="h-5 w-5" />
                </Button>
              )}
              <Button variant="ghost" className="text-danger" disabled={remove.isPending} onClick={() => remove.mutate(p)}>
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="photo-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) add.mutate(file)
        }}
      />
      <Button variant="secondary" disabled={paths.length >= MAX || add.isPending} onClick={() => input.current?.click()}>
        <Camera className="h-5 w-5" /> {add.isPending ? 'Adding…' : paths.length >= MAX ? 'You have 5 pictures' : 'Add a picture'}
      </Button>
    </div>
  )
}
