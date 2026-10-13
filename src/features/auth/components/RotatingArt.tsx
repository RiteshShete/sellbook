import boxScanner from '../../../assets/login/box-scanner.webp'
import handCash from '../../../assets/login/hand-cash.webp'
import { useRandomRotation } from '../rotation'

const ART = [handCash, boxScanner]

/** Decorative picture above the login heading; crossfades to the other one at random intervals. */
export function RotatingArt() {
  const active = useRandomRotation(ART.length)
  return (
    <div className="pointer-events-none relative min-h-64 w-full flex-1" aria-hidden>
      {ART.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className={`absolute inset-0 m-auto h-full w-full scale-125 object-contain transition-opacity duration-700 ${i === active ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
    </div>
  )
}
