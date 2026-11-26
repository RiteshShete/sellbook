/** The VAPID public key (URL-safe base64) as the bytes `pushManager.subscribe` wants. */
export function keyToBytes(key: string): Uint8Array<ArrayBuffer> {
  const b64 = key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (key.length % 4)) % 4)
  const raw = atob(b64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Whether this browser can do web push at all (needs HTTPS; iPhones only inside the installed home-screen app). */
export function pushSupport(win: object): 'supported' | 'unsupported' {
  return 'serviceWorker' in win && 'PushManager' in win && 'Notification' in win ? 'supported' : 'unsupported'
}

/** The two keys the database stores, from a browser subscription. */
export function subscriptionParts(sub: PushSubscription): { endpoint: string; p256dh: string; auth: string } | null {
  const json = sub.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  return json.endpoint && p256dh && auth ? { endpoint: json.endpoint, p256dh, auth } : null
}
