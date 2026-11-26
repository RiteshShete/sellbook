import { describe, expect, it } from 'vitest'
import { notificationJson, parsePayload, safeEqual } from '../../../supabase/functions/push-owner/payload'
import { keyToBytes, pushSupport } from './pushLib'

const sub = { endpoint: 'https://fcm.example.test/send/abc', p256dh: 'p'.repeat(40), auth: 'a'.repeat(16) }
const good = { title: 'New order', body: 'Order #3 from Asha', path: 'orders/0f8fad5b-d9cb', tag: 'order-1', subs: [sub] }

describe('push-owner payload', () => {
  it('accepts exactly what the trigger sends', () => expect(parsePayload(good)).toEqual(good))
  it.each([
    ['not an object', 'x'],
    ['no devices', { ...good, subs: [] }],
    ['too many devices', { ...good, subs: Array(11).fill(sub) }],
    ['an http address', { ...good, subs: [{ ...sub, endpoint: 'http://x.test/aaaa' }] }],
    ['a path that leaves the app', { ...good, path: '../evil?x=1' }],
    ['an empty title', { ...good, title: '' }],
    ['a long body', { ...good, body: 'x'.repeat(201) }],
  ])('refuses %s', (_n, bad) => expect(parsePayload(bad)).toBeNull())
  it('builds an absolute link in the app', () => {
    expect(JSON.parse(notificationJson(good, 'https://shop.example.test/sellbook/')).url).toBe('https://shop.example.test/sellbook/orders/0f8fad5b-d9cb')
  })
  it('compares the secret without leaking length-equal mismatches', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('push helpers in the app', () => {
  it('turns a VAPID key into the 65 bytes the browser wants', () => {
    const bytes = keyToBytes('BAEC' + 'A'.repeat(83))
    expect(bytes.length).toBe(65)
    expect(bytes[0]).toBe(4)
  })
  it('reports unsupported when the browser has no push', () => {
    expect(pushSupport({})).toBe('unsupported')
  })
})
