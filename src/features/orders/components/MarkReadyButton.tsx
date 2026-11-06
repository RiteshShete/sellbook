import { useEffect, useRef, useState } from 'react'
import { Button, PackingAnimation } from '../../../components/ui'
import { ACTION_STYLES } from '../../../lib/actionStyles'
import { prefersReducedMotion } from '../../../lib/motion'

type Phase = 'idle' | 'centering' | 'packing' | 'done'

const CENTER_MS = 300
const HOLD_MS = 500
const { Icon } = ACTION_STYLES.ready

/**
 * "Mark ready" with a little story, all inside the button: the icon slides to the centre while the
 * label fades, a white crate is packed, and only then `onReady` runs (the order moves).
 * With "reduce motion" it just calls `onReady`.
 */
export function MarkReadyButton({
  onReady,
  disabled = false,
}: {
  onReady: () => void
  disabled?: boolean
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [dx, setDx] = useState(0)
  const icon = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (phase === 'centering') {
      const t = setTimeout(() => setPhase('packing'), CENTER_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'done') {
      // The order normally leaves the list now; if the move failed, the button comes back.
      const t = setTimeout(() => setPhase('idle'), HOLD_MS)
      return () => clearTimeout(t)
    }
  }, [phase])

  const start = () => {
    if (phase !== 'idle') return
    const btn = icon.current?.closest('button')
    if (prefersReducedMotion() || !icon.current || !btn) return onReady()
    const b = btn.getBoundingClientRect()
    const i = icon.current.getBoundingClientRect()
    setDx(b.left + b.width / 2 - (i.left + i.width / 2))
    setPhase('centering')
  }

  const busy = phase !== 'idle'
  const packed = phase === 'packing' || phase === 'done'
  return (
    <Button
      variant="ready"
      disabled={disabled}
      aria-busy={busy}
      aria-label={busy ? 'Marking ready' : undefined}
      className="relative"
      onClick={start}
    >
      <span
        ref={icon}
        className={`flex transition-transform duration-300 ease-out ${packed ? 'opacity-0' : ''}`}
        style={{ transform: busy ? `translateX(${dx}px)` : undefined }}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      </span>
      <span className={`transition-opacity duration-200 ${busy ? 'opacity-0' : ''}`}>
        Mark ready
      </span>
      {packed && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <PackingAnimation
            className="size-20 shrink-0"
            onDone={() => {
              setPhase('done')
              onReady()
            }}
          />
        </span>
      )}
    </Button>
  )
}
