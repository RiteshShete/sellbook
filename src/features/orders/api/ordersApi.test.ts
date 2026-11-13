import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { fetchVersions, searchFilter } from './ordersApi'

describe('searchFilter', () => {
  it('is null for blank input', () => {
    expect(searchFilter('   ')).toBeNull()
  })

  it('searches names only for short text', () => {
    expect(searchFilter('Asha')).toBe('customer_name.ilike.*Asha*')
  })

  it('adds phone digits when 3+ digits are typed', () => {
    expect(searchFilter('98765 4')).toBe(
      'customer_name.ilike.*98765 4*,customer_phone.like.*987654*',
    )
  })

  it('matches order / bill numbers for "12", "#12" and "INV-12"', () => {
    expect(searchFilter('12')).toBe('customer_name.ilike.*12*,order_no.eq.12,bill_no.eq.12')
    expect(searchFilter('#12')).toContain('order_no.eq.12')
    expect(searchFilter('INV-0012')).toContain('bill_no.eq.12')
  })

  it('strips characters that would break the or() filter', () => {
    expect(searchFilter('a,b(c)*%')).toBe('customer_name.ilike.*a b c*')
  })
})

describe('fetchVersions', () => {
  const snap = {
    customer_name: 'Asha',
    customer_phone: null,
    order_date: '2026-11-01',
    due_date: null,
    notes: null,
    discount: 0,
    total: 100,
    status: 'new',
    payment_status: 'pending',
    payment_mode: null,
    items: [],
  }
  const row = (version_no: number) => ({
    version_no,
    reason: 'status',
    summary: null,
    created_at: '2026-11-01T00:00:00Z',
    snapshot: snap,
  })

  it('reads the rebuilt full states through list_order_versions, newest first', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row(1), row(3), row(2)], error: null })
    const out = await fetchVersions({ rpc } as unknown as SupabaseClient, 'order-1')
    expect(rpc).toHaveBeenCalledWith('list_order_versions', { p_order: 'order-1' })
    expect(out.map((v) => v.version_no)).toEqual([3, 2, 1])
  })
})
