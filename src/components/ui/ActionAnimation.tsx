import { useEffect, useRef } from 'react'
import { hexToRgb, recolorLottie, type Rgb } from '../../lib/lottieColors'

export type ActionAnimationKind = 'packing' | 'delivery'

interface Source {
  load: () => Promise<{ default: unknown }>
  /** Playback speed: packing is 3 s (played 2.5x), delivery is already 1 s. */
  speed: number
  /** White line-art over the button colour (`token`), or the artwork's own colours (null). */
  whiteOn: string | null
}

const SOURCES: Record<ActionAnimationKind, Source> = {
  packing: {
    load: () => import('../../assets/animations/packing.json'),
    speed: 2.5,
    whiteOn: '--info',
  },
  delivery: {
    load: () => import('../../assets/animations/delivery.json'),
    speed: 1,
    whiteOn: null,
  },
}

const WHITE: Rgb = [1, 1, 1]

/** A colour token (e.g. "--info") as Lottie RGB, so a recoloured animation's solid faces match the button behind it. */
function tokenRgb(name: string, fallback: Rgb): Rgb {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)
  return hexToRgb(v) ?? fallback
}

/**
 * A short Lottie animation (src/assets/animations/) played once inside an action button.
 * `onDone` fires exactly once when it finishes, or at once if the player cannot load, so the
 * action behind it never gets stuck. lottie-web (light, SVG) is loaded on first use and is not
 * part of the startup bundle.
 */
export function ActionAnimation({
  kind,
  onDone,
  className = 'size-24',
}: {
  kind: ActionAnimationKind
  onDone: () => void
  className?: string
}) {
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
    const src = SOURCES[kind]
    void Promise.all([import('lottie-web/build/player/lottie_light'), src.load()])
      .then(([lottie, data]) => {
        if (cancelled || !box.current) return
        const animationData = src.whiteOn
          ? recolorLottie(data.default, {
              stroke: WHITE,
              fill: tokenRgb(src.whiteOn, [0.114, 0.306, 0.847]),
            })
          : data.default
        const anim = lottie.default.loadAnimation({
          container: box.current,
          renderer: 'svg',
          loop: false,
          autoplay: true,
          animationData,
        })
        anim.setSpeed(src.speed)
        anim.addEventListener('complete', finish)
        destroy = () => anim.destroy()
      })
      .catch((e: unknown) => {
        console.warn('Animation unavailable, continuing without it', e)
        finish()
      })
    return () => {
      cancelled = true
      destroy?.()
    }
  }, [kind])

  return <div ref={box} aria-hidden className={className} />
}
