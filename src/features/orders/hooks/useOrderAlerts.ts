import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { toast } from '../../../components/ui'
import { alertSoundOn, playAlert } from '../../../lib/alertSound'
import { invalidateOrders } from '../../../lib/invalidate'
import { useAuth } from '../../auth/useAuth'
import { alertFor, titleWithCount } from '../orderAlerts'
import { useNeedsAction } from './useCustomerOrders'

/**
 * Live alerts for the owner (mounted once, in the app frame): changes to the shop's orders arrive through Realtime (the
 * database only sends this shop's own rows), refresh every order screen, and a new customer order or a payment claim shows
 * a message (and a soft beep if the owner turned it on). The page title carries the count of orders that need action.
 * If realtime is unavailable the 30-second refresh of the needs-action list still catches everything.
 */
export function useOrderAlerts() {
  const { client, session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user.id
  const waiting = useNeedsAction().data?.length ?? 0

  useEffect(() => {
    if (!userId) return
    const channel = client
      .channel(`owner-orders-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        void invalidateOrders(queryClient)
        const message = alertFor(payload)
        if (message) {
          toast.success(message)
          if (alertSoundOn()) playAlert()
        }
      })
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [client, queryClient, userId])

  useEffect(() => {
    const base = document.title
    document.title = titleWithCount(base, waiting)
    return () => {
      document.title = titleWithCount(base, 0)
    }
  }, [waiting])
}
