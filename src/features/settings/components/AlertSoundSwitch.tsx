import { useState } from 'react'
import { Switch } from '../../../components/ui'
import { alertSoundOn, playAlert, setAlertSound } from '../../../lib/alertSound'

/** A soft beep for a new customer order or a payment claim. Off by default; remembered on this phone only. */
export function AlertSoundSwitch() {
  const [on, setOn] = useState(() => alertSoundOn())
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-display text-xl">Alerts</h2>
      <Switch
        label="Play a sound for new customer orders and payment claims"
        checked={on}
        onChange={(v) => {
          setOn(v)
          setAlertSound(v)
          if (v) playAlert() // also lets the browser start audio (it needs a tap first)
        }}
      />
      <p className="mt-1 text-sm text-muted">Only on this phone. You always see a message on screen.</p>
    </section>
  )
}
