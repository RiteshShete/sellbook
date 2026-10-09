import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareImage } from './share'

const png = new Blob(['x'], { type: 'image/png' })

function stubNavigator(canShare: boolean, share: () => Promise<void>) {
  vi.stubGlobal('navigator', { ...navigator, canShare: () => canShare, share })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('shareImage', () => {
  it('shares the PNG as a named file', async () => {
    const share = vi.fn(() => Promise.resolve())
    stubNavigator(true, share)
    await expect(shareImage(png, 'INV-0001.png', 'Bill')).resolves.toBe('shared')
    const arg = share.mock.calls[0] as unknown as [ShareData]
    const file = arg[0].files?.[0]
    expect(file?.name).toBe('INV-0001.png')
    expect(file?.type).toBe('image/png')
    expect(arg[0].text).toBeUndefined()
  })

  it('sends the message text with the image when given', async () => {
    const share = vi.fn(() => Promise.resolve())
    stubNavigator(true, share)
    await shareImage(png, 'a.png', 'Bill', 'Pay by UPI: upi://pay?pa=x')
    const arg = share.mock.calls[0] as unknown as [ShareData]
    expect(arg[0].text).toBe('Pay by UPI: upi://pay?pa=x')
  })

  it('treats closing the sheet as cancelled, not an error', async () => {
    stubNavigator(true, () => Promise.reject(new DOMException('closed', 'AbortError')))
    await expect(shareImage(png, 'a.png', 'Bill')).resolves.toBe('cancelled')
  })

  it('rethrows other share errors', async () => {
    stubNavigator(true, () => Promise.reject(new DOMException('no', 'NotAllowedError')))
    await expect(shareImage(png, 'a.png', 'Bill')).rejects.toThrow('no')
  })

  it('downloads when file sharing is unsupported', async () => {
    const share = vi.fn(() => Promise.resolve())
    stubNavigator(false, share)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    await expect(shareImage(png, 'a.png', 'Bill')).resolves.toBe('downloaded')
    expect(click).toHaveBeenCalledOnce()
    expect(share).not.toHaveBeenCalled()
  })
})
