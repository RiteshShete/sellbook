import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '../../../components/ui'
import { invalidateCatalog } from '../../../lib/invalidate'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../auth/useAuth'
import { applyImport, fetchImportBatches, undoImport } from '../api/importApi'
import type { ApplyPayload } from '../planImport'

export function useImportBatches() {
  const { client } = useAuth()
  return useQuery({
    queryKey: queryKeys.importBatches,
    queryFn: () => fetchImportBatches(client),
  })
}

/** Failures toast through the app-wide mutation handler. */
export function useApplyImport() {
  const { client } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ApplyPayload) => applyImport(client, payload),
    onSettled: () =>
      Promise.all([
        invalidateCatalog(qc),
        qc.invalidateQueries({ queryKey: queryKeys.importBatches }),
      ]),
  })
}

export function useUndoImport() {
  const { client } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => undoImport(client, id),
    onSuccess: (r) =>
      toast.success(
        `Import undone: ${r.products} products and ${r.variants} variants moved to Trash`,
      ),
    onSettled: () =>
      Promise.all([
        invalidateCatalog(qc),
        qc.invalidateQueries({ queryKey: queryKeys.importBatches }),
      ]),
  })
}
