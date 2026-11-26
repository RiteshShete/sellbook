import { useEffect } from 'react'
import { useAuth } from '../auth/useAuth'
import { pushSupport, subscriptionParts } from './pushLib'

/**
 * Once per visit, a phone that already has alerts on re-saves its address: that marks it "still in use", and the weekly
 * cleanup (app_private.prune_push_subscriptions) removes addresses not seen for 90 days. Does nothing if alerts are off.
 */
export function useKeepPushFresh() {
  const { client, status } = useAuth()
  useEffect(() => {
    if (status !== 'signedIn' || pushSupport(window) === 'unsupported' || Notification.permission !== 'granted') return
    void navigator.serviceWorker
      .getRegistration(import.meta.env.BASE_URL)
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        const parts = sub ? subscriptionParts(sub) : null
        if (parts) void client.rpc('save_push_subscription', { p_endpoint: parts.endpoint, p_p256dh: parts.p256dh, p_auth: parts.auth })
      })
      .catch(() => undefined) // a missed refresh only means the next visit tries again
  }, [client, status])
}
