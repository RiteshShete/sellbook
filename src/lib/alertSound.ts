/** The optional beep for a new customer order or payment claim. OFF by default; the choice is kept on this device. */
const KEY = 'sb:alertSound'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function deviceStorage(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function alertSoundOn(storage: StorageLike | null = deviceStorage()): boolean {
  try {
    return storage?.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setAlertSound(on: boolean, storage: StorageLike | null = deviceStorage()): void {
  try {
    storage?.setItem(KEY, on ? '1' : '0')
  } catch {
    // storage blocked: the choice only lasts for this visit
  }
}

/** Two short soft beeps (Web Audio, no file). A browser may refuse until the person has tapped the page once: then it stays silent. */
export function playAlert(): void {
  try {
    const Ctx = window.AudioContext
    const ctx = new Ctx()
    const beep = (at: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.value = 0.08
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + 0.15)
    }
    beep(0)
    beep(0.25)
    window.setTimeout(() => void ctx.close(), 800)
  } catch {
    // no audio available: the visible alert is enough
  }
}
