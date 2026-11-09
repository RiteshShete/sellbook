import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '../components/ui'
import { installGlobalErrorHandlers } from './globalErrors'

vi.mock('../components/ui', () => ({ toast: { error: vi.fn() } }))

describe('installGlobalErrorHandlers', () => {
  let remove: () => void

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    remove = installGlobalErrorHandlers(window)
  })

  afterEach(() => {
    remove()
    vi.restoreAllMocks()
    vi.mocked(toast.error).mockClear()
  })

  it('toasts an unhandled promise rejection', () => {
    const event = Object.assign(new Event('unhandledrejection'), {
      reason: new Error('boom from a promise'),
    })
    window.dispatchEvent(event)
    expect(toast.error).toHaveBeenCalledWith('boom from a promise')
  })

  it('toasts an uncaught error', () => {
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('thrown in a handler') }))
    expect(toast.error).toHaveBeenCalledWith('thrown in a handler')
  })

  it('stops listening once removed', () => {
    remove()
    window.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), { reason: new Error('after removal') }),
    )
    expect(toast.error).not.toHaveBeenCalled()
  })
})
