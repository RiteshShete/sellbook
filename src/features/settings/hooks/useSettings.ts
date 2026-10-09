import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '../../../components/ui'
import { queryKeys } from '../../../lib/queryKeys'
import { useObjectUrl } from '../../../lib/useObjectUrl'
import { useAuth } from '../../auth/useAuth'
import {
  downloadAsset,
  fetchSettings,
  removeAsset,
  updateSettings,
  uploadAsset,
  type AssetChangeResult,
} from '../api/settingsApi'
import type { AssetKind, Settings, SettingsPatch } from '../schemas'

export function useSettings() {
  const { client } = useAuth()
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => fetchSettings(client) })
}

export function useUpdateSettings() {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SettingsPatch }) =>
      updateSettings(client, id, patch),
    onSuccess: (s) => queryClient.setQueryData(queryKeys.settings, s),
  })
}

export function useAssetChange(kind: AssetKind) {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ settings, file }: { settings: Settings; file: File | null }) =>
      file ? uploadAsset(client, settings, kind, file) : removeAsset(client, settings, kind),
    onSuccess: ({ settings, oldFileLeft }: AssetChangeResult) => {
      queryClient.setQueryData(queryKeys.settings, settings)
      if (oldFileLeft) toast.warning('Saved, but the old image could not be deleted from storage.')
    },
  })
}

/** Downloads a private asset and exposes it as an object URL (revoked when it changes). */
export function useAssetUrl(path: string | null) {
  const { client } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.asset(path ?? ''),
    // enabled guards the null case.
    queryFn: () => downloadAsset(client, path ?? ''),
    enabled: path !== null,
    staleTime: Infinity, // paths are unique per upload, so content never changes
  })
  const url = useObjectUrl(query.data)
  return { url, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}
