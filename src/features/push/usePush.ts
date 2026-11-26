import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { keyToBytes, pushSupport, subscriptionParts } from './pushLib'

const VAPID_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || undefined

export type PushState = 'unsupported' | 'unconfigured' | 'blocked' | 'off' | 'on'

const swUrl = () => `${import.meta.env.BASE_URL}sw.js`
const registration = () => navigator.serviceWorker.register(swUrl(), { scope: import.meta.env.BASE_URL })

function initialState(): PushState {
  if (pushSupport(window) === 'unsupported') return 'unsupported'
  if (!VAPID_KEY) return 'unconfigured'
  return Notification.permission === 'denied' ? 'blocked' : 'off'
}

/** Alerts on THIS phone when the app is closed. The database holds the device's address; the switch is per device. */
export function usePush() {
  const { client } = useAuth()
  const [state, setState] = useState<PushState>(initialState)

  useEffect(() => {
    if (state !== 'off') return
    // Already subscribed on this device? (a reload must keep the switch on)
    void navigator.serviceWorker
      .getRegistration(import.meta.env.BASE_URL)
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => sub && setState('on'))
      .catch(() => undefined) // only decides the switch's first position; the user can still tap it
  }, [state])

  const enable = useMutation({
    mutationFn: async () => {
      if (!VAPID_KEY) throw new Error('Alerts are not set up for this shop app yet.')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        throw new Error('Allow notifications in the browser to get alerts.')
      }
      const reg = await registration()
      await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_KEY) }))
      const parts = subscriptionParts(sub)
      if (!parts) throw new Error('This browser gave no alert address. Try another browser.')
      const { error } = await client.rpc('save_push_subscription', { p_endpoint: parts.endpoint, p_p256dh: parts.p256dh, p_auth: parts.auth })
      if (error) throw error
      setState('on')
    },
  })

  const disable = useMutation({
    mutationFn: async () => {
      const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        const { error } = await client.rpc('delete_push_subscription', { p_endpoint: sub.endpoint })
        if (error) throw error
        await sub.unsubscribe()
      }
      setState('off')
    },
  })

  return { state, busy: enable.isPending || disable.isPending, enable: () => enable.mutate(), disable: () => disable.mutate() }
}
