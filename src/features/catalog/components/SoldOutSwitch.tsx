import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Switch } from '../../../components/ui'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../auth/useAuth'
import { saveOnlineDetails } from '../../shop/api/shopApi'
import { useCanWrite } from '../../plan/hooks/usePlan'

/** A one-tap "Sold out" for the online shop (the product stays in your catalogue and can still be added to your own orders). */
export function SoldOutSwitch({ productId, name, available }: { productId: string; name: string; available: boolean }) {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  const canWrite = useCanWrite()
  const set = useMutation({
    mutationFn: (isAvailable: boolean) => saveOnlineDetails(client, productId, { is_available: isAvailable }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
  })
  return (
    <Switch
      label={`Sold out: ${name}`}
      checked={!available}
      disabled={!canWrite || set.isPending}
      onChange={(soldOut) => set.mutate(!soldOut)}
    />
  )
}
