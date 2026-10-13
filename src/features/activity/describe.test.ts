import { describe, expect, it } from 'vitest'
import { dayLabel, isoDay } from '../../lib/dates'
import type { AuditRow } from './api/activityApi'
import { describeActivity, humanizeOrderDetail } from './describe'

const ID = '5d0f5a3e-8f3a-4c0e-9a57-0f6a2b1c3d4e'
const row = (entity: AuditRow['entity'], summary: string): AuditRow => ({
  id: 1,
  created_at: '2026-10-13T05:00:00Z',
  entity,
  entity_id: ID,
  action: 'update',
  summary,
})

describe('humanizeOrderDetail', () => {
  it('turns status changes into plain words', () => {
    expect(humanizeOrderDetail('Status: new → ready')).toBe('Marked ready')
    expect(humanizeOrderDetail('Status: ready → delivered')).toBe('Marked delivered')
    expect(humanizeOrderDetail('Status: new → cancelled')).toBe('Cancelled')
    expect(humanizeOrderDetail('Status: ready → new')).toBe('Moved back to new')
  })
  it('turns payment and bill lines into plain words', () => {
    expect(humanizeOrderDetail('Payment: paid (online)')).toBe('Marked paid (online)')
    expect(humanizeOrderDetail('Payment: pending')).toBe('Payment set back to pending')
    expect(humanizeOrderDetail('bill no. B-12, revision 2')).toBe('Bill B-12 made (revision 2)')
  })
  it('keeps other lines as they are', () => {
    expect(humanizeOrderDetail('Order created')).toBe('Order created')
    expect(humanizeOrderDetail('Moved to Trash')).toBe('Moved to Trash')
  })
})

describe('describeActivity', () => {
  it('shows an order as #number · customer', () => {
    expect(describeActivity(row('order', '#13 Rahul Patil: Status: new → ready'))).toEqual({
      kind: 'order',
      entityId: ID,
      heading: '#13 · Rahul Patil',
      text: 'Marked ready',
    })
  })
  it('files a bill under its order', () => {
    const line = describeActivity(row('bill', '#13 Rahul: bill no. 7, revision 1'))
    expect(line?.kind).toBe('order')
    expect(line?.text).toBe('Bill 7 made (revision 1)')
  })
  it('names products and variants without developer wording', () => {
    expect(describeActivity(row('product', 'Product Besan added'))).toMatchObject({
      kind: 'product',
      heading: 'Product · Besan',
      text: 'Added',
    })
    expect(describeActivity(row('variant', 'Variant Retail moved to Trash'))).toMatchObject({
      kind: 'variant',
      heading: 'Variant · Retail',
      text: 'Moved to Trash',
    })
  })
  it('hides settings changes', () => {
    expect(describeActivity(row('settings', 'Settings updated'))).toBeNull()
  })
})

describe('day grouping helpers', () => {
  it('uses the IST day, not the device day', () => {
    // 20:00 UTC on 12 Oct is already 13 Oct in India.
    expect(isoDay('2026-10-12T20:00:00Z')).toBe('2026-10-13')
  })
  it('labels today and yesterday', () => {
    expect(dayLabel('2026-10-13', '2026-10-13')).toBe('Today')
    expect(dayLabel('2026-10-12', '2026-10-13')).toBe('Yesterday')
    expect(dayLabel('2026-10-01', '2026-10-13')).toBe('01 Oct 2026')
  })
})
