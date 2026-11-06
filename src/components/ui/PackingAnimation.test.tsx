import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const listeners: Record<string, () => void> = {}
const destroy = vi.fn()
const loadAnimation = vi.fn(() => ({
  setSpeed: vi.fn(),
  destroy,
  addEventListener: (name: string, fn: () => void) => {
    listeners[name] = fn
  },
}))

vi.mock('lottie-web/build/player/lottie_light', () => ({ default: { loadAnimation } }))

import { PackingAnimation } from './PackingAnimation'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PackingAnimation', () => {
  it('plays once and calls onDone exactly once when it completes', async () => {
    const onDone = vi.fn()
    render(<PackingAnimation onDone={onDone} />)
    await waitFor(() => expect(loadAnimation).toHaveBeenCalled())
    expect(onDone).not.toHaveBeenCalled()
    listeners.complete?.()
    listeners.complete?.()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('cleans up the player and never calls onDone after unmount', async () => {
    const onDone = vi.fn()
    const { unmount } = render(<PackingAnimation onDone={onDone} />)
    await waitFor(() => expect(loadAnimation).toHaveBeenCalled())
    unmount()
    expect(destroy).toHaveBeenCalled()
    listeners.complete?.()
    expect(onDone).not.toHaveBeenCalled()
  })
})
