import { useEffect, useState } from 'react'
import { resendSecondsLeft } from './otp'

/** Seconds until "Resend" is allowed. Pass the time (ms) the last code was sent, or null before any was sent. */
export function useResendCountdown(sentAt: number | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (sentAt === null) return
    // The first tick comes after a second; until then `now` can be older than `sentAt`, which resendSecondsLeft clamps.
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [sentAt])
  return sentAt === null ? 0 : resendSecondsLeft(sentAt, now)
}
