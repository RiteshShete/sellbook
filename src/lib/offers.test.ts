import { describe, expect, it } from 'vitest'
import { OFFER_WINDOW } from '../features/storefront/contract.fixtures'
import { defaultOfferDates, offerState } from './offers'

// 24 and 25 Nov 2026 entered by the owner; stored [24 Nov 00:00 IST, 26 Nov 00:00 IST)
const offer = { offer_price: 120, offer_starts_at: OFFER_WINDOW.startsAtUtc, offer_ends_at: OFFER_WINDOW.endsAtUtc }

describe('offerState', () => {
  it('has no state without an offer price', () => {
    expect(offerState({ ...offer, offer_price: null }).status).toBe('none')
  })

  it('shows the inclusive dates the owner entered, not the stored exclusive end', () => {
    const s = offerState(offer, new Date('2026-11-24T10:00:00Z'))
    expect([s.startsOn, s.endsOn]).toEqual(['2026-11-24', '2026-11-25'])
  })

  it.each([
    ['23 Nov 23:59:59 IST', '2026-11-23T18:29:59Z', 'scheduled'],
    ['24 Nov 00:00:00 IST', '2026-11-23T18:30:00Z', 'active'],
    ['25 Nov 23:59:59 IST', '2026-11-25T18:29:59Z', 'active'],
    ['26 Nov 00:00:00 IST', '2026-11-25T18:30:00Z', 'ended'],
  ])('%s is %s', (_label, at, status) => {
    expect(offerState(offer, new Date(at)).status).toBe(status)
  })

  it('says when an active offer ends', () => {
    expect(offerState(offer, new Date('2026-11-24T10:00:00Z')).hint).toBe('Ends tomorrow')
    expect(offerState(offer, new Date('2026-11-25T10:00:00Z')).hint).toBe('Ends today')
    expect(offerState({ ...offer, offer_ends_at: '2026-11-29T18:30:00Z' }, new Date('2026-11-24T10:00:00Z')).hint).toBe('Ends in 5 days')
  })

  it('an open-ended offer is active with no end hint', () => {
    const s = offerState({ offer_price: 90, offer_starts_at: null, offer_ends_at: null })
    expect([s.status, s.endsOn, s.hint]).toEqual(['active', null, ''])
  })
})

describe('defaultOfferDates', () => {
  it('is today to tomorrow in IST, even late in the evening UTC', () => {
    // 20:00 UTC on 23 Nov is already 01:30 IST on 24 Nov
    expect(defaultOfferDates(new Date('2026-11-23T20:00:00Z'))).toEqual({ from: '2026-11-24', to: '2026-11-25' })
  })
})
