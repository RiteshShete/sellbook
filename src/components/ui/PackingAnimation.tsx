import { useEffect, useRef } from 'react'

/** The 3 s crate animation played 2.5x faster (about 1.2 s): long enough to enjoy, short enough to not block. */
const SPEED = 2.5

/**
 * The crate being packed (src/assets/animations/packing.json), played once. `onDone` fires exactly
 * once when it finishes, or at once if the player cannot load, so the action behind it never gets stuck.
 * lottie-web (light, SVG) is loaded on first use and is not part of the startup bundle.
 */
export function PackingAnimation({ onDone }: { onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const done = useRef(onDone)
  const fired = useRef(false)

  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    let cancelled = false
    let destroy: (() => void) | undefined
    const finish = () => {
      if (cancelled || fired.current) return
      fired.current = true
      done.current()
    }
    void Promise.all([
      import('lottie-web/build/player/lottie_light'),
      import('../../assets/animations/packing.json'),
    ])
      .then(([lottie, data]) => {
        if (cancelled || !box.current) return
        const anim = lottie.default.loadAnimation({
          container: box.current,
          renderer: 'svg',
          loop: false,
          autoplay: true,
          animationData: data.default,
        })
        anim.setSpeed(SPEED)
        anim.addEventListener('complete', finish)
        destroy = () => anim.destroy()
      })
      .catch((e: unknown) => {
        console.warn('Packing animation unavailable, continuing without it', e)
        finish()
      })
    return () => {
      cancelled = true
      destroy?.()
    }
  }, [])

  return <div ref={box} aria-hidden className="size-24" />
}
