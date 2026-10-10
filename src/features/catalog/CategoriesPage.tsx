import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Page } from '../../app/Page'
import {
  BottomSheet,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  toast,
} from '../../components/ui'
import { pluralize } from '../../lib/format'
import { moveId } from './categories'
import {
  useCategories,
  useProducts,
  useReorderCategories,
  useRestoreCategory,
  useSaveCategory,
  useTrashCategory,
} from './hooks/useCatalog'
import type { Category } from './schemas'

const iconBtn =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted active:bg-surface-2 disabled:opacity-40'

/** Create, rename, reorder and delete (to Trash, with Undo) product categories. Starts empty. */
export function CategoriesPage() {
  const cats = useCategories()
  const products = useProducts()
  const save = useSaveCategory()
  const reorder = useReorderCategories()
  const trash = useTrashCategory()
  const restore = useRestoreCategory()
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<Category | null>(null)
  const [editName, setEditName] = useState('')
  const [deleting, setDeleting] = useState<Category | null>(null)

  const list = cats.data?.categories ?? []
  const ids = list.map((c) => c.id)
  const count = (id: string) => (products.data ?? []).filter((p) => p.category_id === id).length

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    save.mutate({ name }, { onSuccess: () => setNewName('') })
  }

  function onRename(e: FormEvent) {
    e.preventDefault()
    const name = editName.trim()
    if (!editing || !name) return
    save.mutate({ id: editing.id, name }, { onSuccess: () => setEditing(null) })
  }

  function onDelete() {
    const c = deleting
    if (!c) return
    trash.mutate(c.id, {
      onSuccess: () => {
        setDeleting(null)
        toast(`${c.name} moved to Trash`, {
          action: { label: 'Undo', onClick: () => restore.mutate(c.id) },
        })
      },
    })
  }

  return (
    <Page title="Categories" back="/catalog">
      {cats.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : cats.isError ? (
        <ErrorState error={cats.error} onRetry={() => void cats.refetch()} />
      ) : !cats.data.available ? (
        <EmptyState
          title="Categories need a database update"
          description="Apply the latest migration (supabase db push), then reload."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <form onSubmit={onAdd} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Input
                label="New category"
                value={newName}
                maxLength={60}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={save.isPending || newName.trim() === ''}>
              Add
            </Button>
          </form>

          {list.length === 0 ? (
            <EmptyState
              title="No categories yet"
              description="Group products, for example by type. Products without one stay under Uncategorised."
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {list.map((c, i) => (
                <li key={c.id} className="flex items-center gap-1 py-1 pr-1 pl-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{c.name}</p>
                    <p className="text-sm text-muted">{pluralize(count(c.id), 'product')}</p>
                  </div>
                  <button
                    type="button"
                    className={iconBtn}
                    disabled={i === 0 || reorder.isPending}
                    aria-label={`Move ${c.name} up`}
                    onClick={() => reorder.mutate(moveId(ids, c.id, -1))}
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    disabled={i === list.length - 1 || reorder.isPending}
                    aria-label={`Move ${c.name} down`}
                    onClick={() => reorder.mutate(moveId(ids, c.id, 1))}
                  >
                    <ArrowDown className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label={`Rename ${c.name}`}
                    onClick={() => {
                      setEditing(c)
                      setEditName(c.name)
                    }}
                  >
                    <Pencil className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className={`${iconBtn} text-danger`}
                    aria-label={`Delete ${c.name}`}
                    onClick={() => setDeleting(c)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <BottomSheet open={editing !== null} onClose={() => setEditing(null)} title="Rename category">
        <form onSubmit={onRename} className="flex flex-col gap-3">
          <Input
            label="Name"
            value={editName}
            maxLength={60}
            onChange={(e) => setEditName(e.target.value)}
          />
          <Button type="submit" block disabled={save.isPending || editName.trim() === ''}>
            Save
          </Button>
        </form>
      </BottomSheet>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete category?"
        message={`"${deleting?.name ?? ''}" goes to Trash. Its products stay and show under Uncategorised; restoring it brings them back.`}
        confirmLabel="Move to Trash"
        destructive
        busy={trash.isPending}
        onConfirm={onDelete}
        onCancel={() => setDeleting(null)}
      />
    </Page>
  )
}
