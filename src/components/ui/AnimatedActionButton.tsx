import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ACTION_STYLES, type ActionKind } from '../../lib/actionStyles'
import { prefersReducedMotion } from '../../lib/motion'
import { ActionAnimation, type ActionAnimationKind } from './ActionAnimation'
import { Button } from './Button'

type Phase = 'idle' | 'centering' | 'playing' | 'done'

const CENTER_MS = 300
const HOLD_MS = 500

/**
 * An order action button with a little story, all inside the button: the icon slides to the
 * centre while the label fades, an animation plays, and only then `onAction` runs (the order
 * moves, or the payment sheet opens). With "reduce motion" it just calls `onAction`.
 */
export function AnimatedActionButton({
  kind,
  animation,
  children,
  onAction,
  disabled = false,
  className = '',
}: {
  kind: ActionKind
  animation: ActionAnimationKind
  children: ReactNode
  onAction: () => void
  disabled?: boolean
  className?: string
}) {
  const Icon = ACTION_STYLES[kind].Icon
  const [phase, setPhase] = useState<Phase>('idle')
  const [dx, setDx] = useState(0)
  const icon = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (phase === 'centering') {
      const t = setTimeout(() => setPhase('playing'), CENTER_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'done') {
      // The order normally leaves the list now; if the action failed, the button comes back.
      const t = setTimeout(() => setPhase('idle'), HOLD_MS)
      return () => clearTimeout(t)
    }
  }, [phase])

  const start = () => {
    if (phase !== 'idle') return
    const btn = icon.current?.closest('button')
    if (prefersReducedMotion() || !icon.current || !btn) return onAction()
    const b = btn.getBoundingClientRect()
    const i = icon.current.getBoundingClientRect()
    setDx(b.left + b.width / 2 - (i.left + i.width / 2))
    setPhase('centering')
  }

  const busy = phase !== 'idle'
  const playing = phase === 'playing' || phase === 'done'
  return (
    <Button
      variant={kind}
      disabled={disabled}
      aria-busy={busy}
      className={`relative ${className}`}
      onClick={start}
    >
      <span
        ref={icon}
        className={`flex transition-transform duration-300 ease-out ${playing ? 'opacity-0' : ''}`}
        style={{ transform: busy ? `translateX(${dx}px)` : undefined }}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      </span>
      <span className={`transition-opacity duration-200 ${busy ? 'opacity-0' : ''}`}>
        {children}
      </span>
      {busy && <span className="sr-only">Working</span>}
      {playing && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <ActionAnimation
            kind={animation}
            className="size-20 shrink-0"
            onDone={() => {
              setPhase('done')
              onAction()
            }}
          />
        </span>
      )}
    </Button>
  )
}
