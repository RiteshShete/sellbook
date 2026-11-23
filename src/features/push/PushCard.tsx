import { Switch } from '../../components/ui'
import { usePush, type PushState } from './usePush'

const NOTES: Record<PushState, string> = {
  unsupported: 'This browser cannot show alerts when the app is closed. On an iPhone, add Sellbook to the Home Screen first, then open it from there.',
  unconfigured: 'Alerts when the app is closed are not switched on for this app yet.',
  blocked: 'Notifications are blocked for this site. Allow them in the browser settings, then come back.',
  off: 'Get a phone alert for a new customer order or a payment claim, even when the app is closed. Only on this phone.',
  on: 'On for this phone. You get an alert for a new customer order or a payment claim. It says nothing about the amount: open the app to check your bank.',
}

export function PushCard() {
  const { state, busy, enable, disable } = usePush()
  const usable = state === 'off' || state === 'on'
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-display text-xl">Alerts when the app is closed</h2>
      <Switch label="Phone alerts for customer orders and payments" checked={state === 'on'} disabled={!usable || busy} onChange={(v) => (v ? enable() : disable())} />
      <p className="mt-1 text-sm text-muted">{NOTES[state]}</p>
    </section>
  )
}
