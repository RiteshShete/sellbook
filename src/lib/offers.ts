import { addDaysIST, isoDay, todayIST } from './dates'

export type OfferStatus = 'none' | 'scheduled' | 'active' | 'ended'

export interface OfferFields {
  offer_price: unknown
  offer_starts_at: string | null
  offer_ends_at: string | null
}

export interface OfferState {
  status: OfferStatus
  /** First and last day of the offer as the owner entered them (inclusive IST dates), when known. */
  startsOn: string | null
  endsOn: string | null
  /** Text such as "Ends tomorrow" for an active offer; "" otherwise. */
  hint: string
}

const DAY = 86_400_000

/**
 * Where an offer is in its life. The database stores the end as the NEXT IST midnight (exclusive); the owner thinks in
 * inclusive dates, so the last day is the day containing (end - 1 ms).
 */
export function offerState(v: OfferFields, now: Date = new Date()): OfferState {
  const starts = v.offer_starts_at ? new Date(v.offer_starts_at) : null
  const ends = v.offer_ends_at ? new Date(v.offer_ends_at) : null
  const startsOn = starts ? isoDay(starts) : null
  const endsOn = ends ? isoDay(new Date(ends.getTime() - 1)) : null
  if (v.offer_price === null || v.offer_price === undefined) return { status: 'none', startsOn: null, endsOn: null, hint: '' }
  if (ends && now >= ends) return { status: 'ended', startsOn, endsOn, hint: '' }
  if (starts && now < starts) return { status: 'scheduled', startsOn, endsOn, hint: '' }
  return { status: 'active', startsOn, endsOn, hint: endsOn ? endsHint(endsOn, todayIST(now)) : '' }
}

function endsHint(endsOn: string, today: string): string {
  const days = Math.round((Date.parse(endsOn) - Date.parse(today)) / DAY)
  if (days <= 0) return 'Ends today'
  if (days === 1) return 'Ends tomorrow'
  return `Ends in ${days} days`
}

/** Default dates for a new offer: from today to tomorrow (inclusive). */
export const defaultOfferDates = (now: Date = new Date()) => ({ from: todayIST(now), to: addDaysIST(todayIST(now), 1) })
