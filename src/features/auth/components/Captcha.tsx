import { useEffect, useRef, useState } from 'react'

/** Cloudflare Turnstile site key (public). Empty = no check (local development). */
const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || undefined

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      scriptPromise = null
      reject(new Error('The security check could not load. Check your connection and reload.'))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

export const captchaRequired = Boolean(SITE_KEY)

/**
 * The "I am not a robot" check on sign-up and password reset. Renders nothing without a site key.
 * `onToken(null)` means the check expired or failed: the form must not submit until a new token arrives.
 */
export function Captcha({ onToken }: { onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!SITE_KEY || !box.current) return
    let widget: string | undefined
    let gone = false
    loadScript()
      .then(() => {
        if (gone || !box.current || !window.turnstile) return
        widget = window.turnstile.render(box.current, {
          sitekey: SITE_KEY,
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        })
      })
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'The security check failed.'))
    return () => {
      gone = true
      if (widget) window.turnstile?.remove(widget)
    }
  }, [onToken])

  if (!SITE_KEY) return null
  return (
    <div>
      <div ref={box} />
      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
    </div>
  )
}
