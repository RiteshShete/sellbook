import { describe, expect, it } from 'vitest'
import { alertSoundOn, setAlertSound } from './alertSound'

function memory() {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
}

describe('alert sound setting', () => {
  it('is off until the owner turns it on', () => {
    expect(alertSoundOn(memory())).toBe(false)
  })
  it('remembers on and off', () => {
    const s = memory()
    setAlertSound(true, s)
    expect(alertSoundOn(s)).toBe(true)
    setAlertSound(false, s)
    expect(alertSoundOn(s)).toBe(false)
  })
  it('is off, without an error, when storage is missing or blocked', () => {
    expect(alertSoundOn(null)).toBe(false)
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(alertSoundOn(blocked)).toBe(false)
    expect(() => setAlertSound(true, blocked)).not.toThrow()
  })
})
